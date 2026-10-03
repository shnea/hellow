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
  private final kr.shnea.hellow.content.CatalogService catalog;
  private final kr.shnea.hellow.customer.CustomerIdentityService customerIdentity;
  private final ConsultationRevisionRepository revisions;

  public ConsultationController(
      ConsultationRepository consultations,
      QueueItemRepository queues,
      TimelineRepository timelines,
      WorkspaceAccess access,
      ObjectMapper json,
      AttachmentRepository attachments,kr.shnea.hellow.content.CatalogService catalog,kr.shnea.hellow.customer.CustomerIdentityService customerIdentity,ConsultationRevisionRepository revisions) {
    this.consultations = consultations;
    this.queues = queues;
    this.timelines = timelines;
    this.access = access;
    this.json = json;
    this.attachments = attachments;
    this.catalog = catalog;
    this.customerIdentity=customerIdentity;this.revisions=revisions;
  }

  public record SaveRequest(
      @NotBlank @Size(max = 100) String categoryMain,
      @NotBlank @Size(max = 100) String categorySub,
      @NotNull @Min(0) Long expectedVersion,
      @Size(max = 200000) String memo,
      @NotNull JsonNode editorDocument,
      @Size(max = 255) String tags,
      @Min(0) int callDurationSeconds,
      boolean complete,
      @Size(max=64) String categoryId,
      @Size(max=64) String resultId) {}

  @GetMapping("/queue/{code}")
  public ResponseEntity<Consultation> draft(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var q =
        queues
            .findByOrganizationIdAndCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    var saved=consultations.findByOrganizationIdAndQueueCode(actor.organizationId(),code);
    if(saved.isPresent()){actor.requireRow(saved.get());return ResponseEntity.ok(saved.get());}
    actor.requireRow(q);
    if(q.getStatus()!=QueueItem.QueueStatus.COMPLETED&&q.getStatus()!=QueueItem.QueueStatus.CANCELLED)q.requireOwner(actor.subject());
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/queue/{code}")
  @Transactional
  public Consultation save(@PathVariable String code, @Valid @RequestBody SaveRequest r) {
    var actor = access.require("consultation:write");
    customerIdentity.lockOrganization(actor.organizationId());
    var q =
        queues
            .lockByCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    var existing = consultations.findByOrganizationIdAndQueueCode(actor.organizationId(), code);
    existing.ifPresent(actor::requireRow);
    actor.requireRow(q);
    boolean historical=q.getStatus()==QueueItem.QueueStatus.COMPLETED||q.getStatus()==QueueItem.QueueStatus.CANCELLED;
    if(historical&&existing.isPresent()&&r.complete()){
      var prior=existing.get();
      if(Objects.equals(prior.getEditorDocument(),r.editorDocument().toString())&&Objects.equals(prior.getCategoryMain(),r.categoryMain())&&Objects.equals(prior.getCategorySub(),r.categorySub())&&Objects.equals(prior.getCategoryId(),r.categoryId())&&Objects.equals(prior.getResultId(),r.resultId())&&Objects.equals(prior.getTags(),r.tags())&&Objects.equals(prior.getMemo(),r.memo()))return prior;
    }
    if(!historical)q.requireOwner(actor.subject());
    if (!historical && r.complete() && q.getType() == QueueItem.ItemType.CALL && !q.isCallEnded())
      throw new ResponseStatusException(CONFLICT, "통화를 종료한 뒤 상담을 완료해 주세요.");
    if (!"shnea-editor".equals(r.editorDocument().path("format").asText())
        || !r.editorDocument().path("content").isObject())
      throw new ResponseStatusException(BAD_REQUEST, "에디터 문서 형식이 올바르지 않습니다.");
    validateFiles(r.editorDocument(), actor.organizationId(), code);
    var classification=catalog.select(actor.organizationId(),r.categoryId(),r.resultId(),existing.orElse(null),r.categoryMain(),r.categorySub(),r.complete());
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
              created.copyOwner(q);
              return created;
            });
    long current = c.getVersion() == null ? 0 : c.getVersion();
    if (current != r.expectedVersion())
      throw new ResponseStatusException(CONFLICT, "다른 창에서 변경된 상담입니다. 초안을 보존하고 최신 기록을 확인해 주세요.");
    if(existing.isPresent())try{revisions.save(new ConsultationRevision(c,actor.subject(),actor.name(),json.writeValueAsString(c)));}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
    customerIdentity.onSave(q,actor);
    c.update(
        q.getCustomerCode(),
        r.categoryMain(),
        r.categorySub(),
        (historical||r.complete())
            ? Consultation.ConsultationStatus.COMPLETED
            : Consultation.ConsultationStatus.IN_PROGRESS,
        r.memo(),
        r.editorDocument().toString(),
        r.tags(),
        r.callDurationSeconds());
    c.classify(classification);
    consultations.saveAndFlush(c);
    if (r.complete()&&!historical) {
      var item =
          new TimelineItem(
              q.getCustomerCode(),
              q.getType() == QueueItem.ItemType.CALL
                  ? TimelineItem.ChannelType.CALL
                  : TimelineItem.ChannelType.TICKET,
              actor.name(),
              "상담 완료: " + c.getCategorySub() + (c.getResultName()==null?"":" · "+c.getResultName()),
              r.memo() == null ? "" : r.memo(),
              false,
              null,
              r.tags());
      item.setOrganizationId(actor.organizationId());
      item.setQueueCode(code);
      item.copyOwner(q);
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
