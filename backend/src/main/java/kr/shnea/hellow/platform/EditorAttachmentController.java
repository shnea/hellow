package kr.shnea.hellow.platform;

import static org.springframework.http.HttpStatus.*;

import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/editor/files")
public class EditorAttachmentController {
  private final PlatformClient platform;
  private final PlatformProperties properties;
  private final AttachmentRepository files;
  private final QueueItemRepository queues;
  private final WorkspaceAccess access;

  public EditorAttachmentController(
      PlatformClient platform,
      PlatformProperties properties,
      AttachmentRepository files,
      QueueItemRepository queues,
      WorkspaceAccess access) {
    this.platform = platform;
    this.properties = properties;
    this.files = files;
    this.queues = queues;
    this.access = access;
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @Transactional
  public Map<String, Object> upload(
      @RequestParam MultipartFile file,
      @RequestParam String queueCode,
      @RequestParam String requestId,
      @RequestParam String scope,
      @RequestParam String kind)
      throws java.io.IOException {
    var actor = access.require("consultation:write");
    var q =
        queues
            .lockByCode(actor.organizationId(), queueCode)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    String expectedScope = actor.organizationId() + ":" + queueCode;
    if (!expectedScope.equals(scope)
        || !Set.of("image", "file", "video", "audio").contains(kind)
        || file.isEmpty()
        || requestId.isBlank()
        || requestId.length() > 100)
      throw new ResponseStatusException(BAD_REQUEST, "파일 업로드 입력을 확인해 주세요.");
    if (properties.getAttachmentRetentionCode().isBlank())
      throw new ResponseStatusException(SERVICE_UNAVAILABLE, "첨부파일 보존 정책이 아직 설정되지 않았습니다.");
    var existing =
        files.findByOrganizationIdAndQueueCodeAndRequestId(
            actor.organizationId(), queueCode, requestId);
    if (existing.isPresent()) return response(existing.get(), scope);
    // Platform request IDs are namespaced by server-verified tenant and interaction.
    String uploadRequest =
        UUID.nameUUIDFromBytes(
                (actor.organizationId() + ":" + queueCode + ":" + requestId)
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            .toString();
    var result = platform.uploadFile(file, uploadRequest);
    var attachment =
        new Attachment(
            actor.organizationId(),
            queueCode,
            result.fileId(),
            requestId,
            result.originalName(),
            kind,
            result.size(),
            result.sha256());
    files.save(attachment);
    return response(attachment, scope);
  }

  @GetMapping("/{fileId}/views")
  public ResponseEntity<Map<String, Object>> views(@PathVariable String fileId) {
    var actor = access.require("consultation:read");
    var file =
        files
            .findByOrganizationIdAndFileId(actor.organizationId(), fileId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    queues
        .findByOrganizationIdAndCode(actor.organizationId(), file.getQueueCode())
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(platform.getViewTicket(fileId));
  }

  private Map<String, Object> response(Attachment file, String scope) {
    return Map.of(
        "fileId",
        file.getFileId(),
        "scope",
        scope,
        "kind",
        file.getKind(),
        "name",
        file.getName(),
        "size",
        file.getSize());
  }
}
