package kr.shnea.hellow.support;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.customer.*;
import kr.shnea.hellow.livekit.LiveKitService;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/support")
public class SupportController {
  private final QueueItemRepository queues;
  private final OrganizationRepository organizations;
  private final LiveKitService media;

  public SupportController(
      QueueItemRepository queues, OrganizationRepository organizations, LiveKitService media) {
    this.queues = queues;
    this.organizations = organizations;
    this.media = media;
  }

  @GetMapping("/organization/{publicCode}")
  public Map<String, String> organization(@PathVariable String publicCode) {
    var o = publicOrg(publicCode);
    return Map.of("name", o.getName());
  }

  public record Request(
      @NotBlank String organizationCode,
      @NotBlank @Size(max = 100) String requestId,
      @NotBlank @Size(max = 100) String customerName,
      @Size(max = 150) String companyName,
      @NotBlank @Size(max = 50) String phoneNumber,
      @NotNull Customer.CustomerType customerType,
      @NotBlank @Size(max = 100) String inquiryType,
      @NotBlank @Size(max = 10000) String message,
      @NotBlank @Pattern(regexp = "CALL|CHAT") String channel) {}

  @PostMapping("/request")
  @Transactional
  public Map<String, Object> create(@Valid @RequestBody Request r) {
    var org =
        organizations
            .lockPublicCode(r.organizationCode())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    // Untrusted public input never confirms an existing customer's identity by phone.
    String key =
        UUID.nameUUIDFromBytes(
                (org.getId() + ":" + r.requestId())
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8))
            .toString();
    var existing = queues.findByRequestKey(key);
    if (existing.isPresent()) return response(existing.get());
    var q =
        new QueueItem(
            "queue-" + UUID.randomUUID(),
            "CHAT".equals(r.channel()) ? QueueItem.ItemType.TICKET : QueueItem.ItemType.CALL,
            r.customerType(),
            r.customerName(),
            r.companyName(),
            r.phoneNumber(),
            "웹 접수",
            "normal",
            r.message(),
            true,
            false,
            false);
    q.setOrganizationId(org.getId());
    q.setSessionId(UUID.randomUUID().toString() + UUID.randomUUID());
    q.setRequestKey(key);
    q.setInquiryType(r.inquiryType());
    queues.save(q);
    return response(q);
  }

  @GetMapping("/session/{sessionId}")
  public Map<String, Object> status(@PathVariable String sessionId) {
    return response(session(sessionId));
  }

  @PostMapping("/session/{sessionId}/cancel")
  @Transactional
  public void cancel(@PathVariable String sessionId) {
    var q = queues.lockSession(sessionId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    requireOrg(q);
    if (q.getStatus() == QueueItem.QueueStatus.WAITING) q.cancel();
    else if (q.getStatus() == QueueItem.QueueStatus.PROCESSING) q.endCall();
    queues.save(q);
  }

  @PostMapping("/session/{sessionId}/end-call")
  @Transactional
  public void end(@PathVariable String sessionId) {
    cancel(sessionId);
  }

  @PostMapping("/session/{sessionId}/token")
  public LiveKitService.LiveKitTokenResponse token(@PathVariable String sessionId) {
    var q = session(sessionId);
    if (q.getStatus() != QueueItem.QueueStatus.PROCESSING
        || q.isCallEnded()
        || q.getType() != QueueItem.ItemType.CALL)
      throw new ResponseStatusException(CONFLICT, "연결 가능한 통화가 아닙니다.");
    return media.createToken(
        q.getOrganizationId() + "-" + q.getCode(),
        "customer-" + q.getCode(),
        q.getCustomerName(),
        false);
  }

  private Map<String, Object> response(QueueItem q) {
    long count =
        queues.countByOrganizationIdAndStatus(q.getOrganizationId(), QueueItem.QueueStatus.WAITING);
    return Map.of(
        "sessionId",
        q.getSessionId(),
        "queueCode",
        q.getCode(),
        "status",
        q.getStatus() == QueueItem.QueueStatus.PROCESSING && q.isCallEnded()
            ? "CALL_ENDED"
            : q.getStatus().name(),
        "assignedAgent",
        q.getAssignedAgent() == null ? "" : q.getAssignedAgent(),
        "waitingPosition",
        count,
        "estimatedWaitSeconds",
        Math.max(30, count * 60));
  }

  private Organization publicOrg(String code) {
    return organizations
        .findByPublicCodeAndActiveTrue(code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "상담 접수 조직을 찾을 수 없습니다."));
  }

  private QueueItem session(String id) {
    var q = queues.findBySessionId(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    requireOrg(q);
    return q;
  }

  private void requireOrg(QueueItem q) {
    if (q.getOrganizationId() == null
        || !organizations.findById(q.getOrganizationId()).map(Organization::isActive).orElse(false))
      throw new ResponseStatusException(NOT_FOUND);
  }
}
