package kr.shnea.hellow.consultation;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.platform.AttachmentRepository;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/consultations")
public class ConsultationController {
  private final ConsultationRepository consultations;
  private final QueueItemRepository queues;
  private final TimelineRepository timelines;
  private final WorkspaceAccess access;
  private final ObjectMapper json;
  private final AttachmentRepository attachments;

  public ConsultationController(
      ConsultationRepository consultations,
      QueueItemRepository queues,
      TimelineRepository timelines,
      WorkspaceAccess access,
      ObjectMapper json,
      AttachmentRepository attachments) {
    this.consultations = consultations;
    this.queues = queues;
    this.timelines = timelines;
    this.access = access;
    this.json = json;
    this.attachments = attachments;
  }

  public record SaveRequest(
      @NotBlank @Size(max = 100) String categoryMain,
      @NotBlank @Size(max = 100) String categorySub,
      @NotNull @Min(0) Long expectedVersion,
      @Size(max = 200000) String memo,
      @NotNull JsonNode editorDocument,
      @Size(max = 255) String tags,
      @Min(0) int callDurationSeconds,
      boolean complete) {}

  @GetMapping("/queue/{code}")
  public ResponseEntity<Consultation> draft(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var q =
        queues
            .findByOrganizationIdAndCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    return consultations
        .findByOrganizationIdAndQueueCode(actor.organizationId(), code)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PutMapping("/queue/{code}")
  @Transactional
  public Consultation save(@PathVariable String code, @Valid @RequestBody SaveRequest r) {
    var actor = access.require("consultation:write");
    var q =
        queues
            .lockByCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    var existing = consultations.findByOrganizationIdAndQueueCode(actor.organizationId(), code);
    if (q.getStatus() == QueueItem.QueueStatus.COMPLETED
        && existing.isPresent()
        && actor.subject().equals(existing.get().getAgentSubject())
        && r.complete()) {
      var saved = existing.get();
      if (java.util.Objects.equals(saved.getEditorDocument(), r.editorDocument().toString())
          && java.util.Objects.equals(saved.getCategoryMain(), r.categoryMain())
          && java.util.Objects.equals(saved.getCategorySub(), r.categorySub())
          && java.util.Objects.equals(saved.getTags(), r.tags())) return saved;
      throw new ResponseStatusException(CONFLICT, "이미 완료된 상담입니다. 새 요청을 저장할 수 없습니다.");
    }
    q.requireOwner(actor.subject());
    if (r.complete() && q.getType() == QueueItem.ItemType.CALL && !q.isCallEnded())
      throw new ResponseStatusException(CONFLICT, "통화를 종료한 뒤 상담을 완료해 주세요.");
    if (!"shnea-editor".equals(r.editorDocument().path("format").asText())
        || !r.editorDocument().path("content").isObject())
      throw new ResponseStatusException(BAD_REQUEST, "에디터 문서 형식이 올바르지 않습니다.");
    validateFiles(r.editorDocument(), actor.organizationId(), code);
    var c =
        existing.orElseGet(
            () -> {
              var created =
                  new Consultation(
                      q.getCustomerCode(),
                      r.categoryMain(),
                      r.categorySub(),
                      Consultation.ConsultationStatus.IN_PROGRESS,
                      "",
                      "",
                      actor.name(),
                      0);
              created.setOrganizationId(actor.organizationId());
              created.bind(code, actor.subject());
              return created;
            });
    long current = c.getVersion() == null ? 0 : c.getVersion();
    if (current != r.expectedVersion())
      throw new ResponseStatusException(CONFLICT, "다른 창에서 변경된 상담입니다. 초안을 보존하고 최신 기록을 확인해 주세요.");
    c.update(
        q.getCustomerCode(),
        r.categoryMain(),
        r.categorySub(),
        r.complete()
            ? Consultation.ConsultationStatus.COMPLETED
            : Consultation.ConsultationStatus.IN_PROGRESS,
        r.memo(),
        r.editorDocument().toString(),
        r.tags(),
        r.callDurationSeconds());
    consultations.saveAndFlush(c);
    if (r.complete()) {
      var item =
          new TimelineItem(
              q.getCustomerCode(),
              q.getType() == QueueItem.ItemType.CALL
                  ? TimelineItem.ChannelType.CALL
                  : TimelineItem.ChannelType.TICKET,
              actor.name(),
              "상담 완료: " + r.categorySub(),
              r.memo() == null ? "" : r.memo(),
              false,
              null,
              r.tags());
      item.setOrganizationId(actor.organizationId());
      item.setQueueCode(code);
      timelines.save(item);
      q.complete();
      queues.save(q);
    }
    return c;
  }

  private void validateFiles(JsonNode node, String organizationId, String code) {
    if (node.isObject()
        && node.hasNonNull("fileId")
        && !attachments.existsByOrganizationIdAndQueueCodeAndFileId(
            organizationId, code, node.get("fileId").asText()))
      throw new ResponseStatusException(FORBIDDEN, "다른 상담의 첨부파일은 저장할 수 없습니다.");
    node.elements().forEachRemaining(child -> validateFiles(child, organizationId, code));
  }
}
