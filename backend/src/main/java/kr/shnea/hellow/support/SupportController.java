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
  private final kr.shnea.hellow.settings.SupportSettingsService settings;
  private final java.time.Clock clock;
  private final com.fasterxml.jackson.databind.ObjectMapper json;
  private final int pendingLimit;

  public SupportController(
      QueueItemRepository queues, OrganizationRepository organizations, LiveKitService media,
      kr.shnea.hellow.settings.SupportSettingsService settings,java.time.Clock clock,com.fasterxml.jackson.databind.ObjectMapper json,
      @org.springframework.beans.factory.annotation.Value("${hellow.public-pending-limit:100}") int pendingLimit) {
    this.queues = queues;
    this.organizations = organizations;
    this.media = media;
    this.settings = settings;
    this.clock=clock;this.json=json;
    if(pendingLimit<1)throw new IllegalArgumentException("Public pending limit must be positive");this.pendingLimit=pendingLimit;
  }

  @GetMapping("/organization/{publicCode}")
  public Map<String, Object> organization(@PathVariable String publicCode) {
    var o = publicOrg(publicCode);
    return Map.of("name", o.getName(), "branding", settings.effective(o.getId()));
  }

  public record Request(
      @NotBlank String organizationCode,
      @NotBlank @Pattern(regexp="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}") String requestId,
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
    String key = requestKey(org.getId(),r.requestId());
    var existing = queues.findByRequestKey(key);
    String fingerprint=fingerprint(r);
    if (existing.isPresent()) {
      var q=existing.get();requireSession(q);
      if(q.getRequestFingerprint()!=null&&!q.getRequestFingerprint().equals(fingerprint))
        throw new ResponseStatusException(CONFLICT,"같은 요청 ID의 접수 내용이 변경되었습니다. 기존 요청을 먼저 확인해 주세요.");
      return response(q);
    }
    if(queues.countByOrganizationIdAndStatusAndSessionIdIsNotNull(org.getId(),QueueItem.QueueStatus.WAITING)>=pendingLimit)
      throw new ResponseStatusException(TOO_MANY_REQUESTS,"이 조직의 접수 대기 요청이 많습니다. 잠시 후 같은 요청으로 다시 시도해 주세요.");
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
    q.initializeSupportSession(clock.instant().plus(java.time.Duration.ofHours(24)),fingerprint);
    q.setInquiryType(r.inquiryType());
    queues.save(q);
    return response(q);
  }

  /** The high-entropy request ID recovers only the explicitly submitted request; GET creates no work. */
  @GetMapping("/request/{publicCode}/{requestId}")
  public Map<String,Object> recover(@PathVariable String publicCode,@PathVariable String requestId){
    var org=publicOrg(publicCode);
    var q=queues.findByRequestKey(requestKey(org.getId(),requestId)).orElseThrow(()->new ResponseStatusException(NOT_FOUND,"이 요청은 아직 접수되지 않았습니다."));
    requireSession(q);return response(q);
  }

  @GetMapping("/session/{sessionId}")
  public Map<String, Object> status(@PathVariable String sessionId) {
    return response(session(sessionId));
  }

  @PostMapping("/session/{sessionId}/cancel")
  @Transactional
  public Map<String,Object> cancel(@PathVariable String sessionId) {
    var q = queues.lockSession(sessionId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    requireSession(q);
    if (q.getStatus() == QueueItem.QueueStatus.WAITING) q.cancel();
    else if (q.getStatus() == QueueItem.QueueStatus.PROCESSING) {
      if(q.getType()!=QueueItem.ItemType.CALL)throw new ResponseStatusException(CONFLICT,"담당자가 이미 확인한 문의입니다. 처리 상태를 확인해 주세요.");
      q.endCall();
    }
    queues.save(q);
    return response(q);
  }

  @PostMapping("/session/{sessionId}/end-call")
  @Transactional
  public Map<String,Object> end(@PathVariable String sessionId) {
    var q=queues.lockSession(sessionId).orElseThrow(()->new ResponseStatusException(NOT_FOUND));requireSession(q);
    if(q.getType()!=QueueItem.ItemType.CALL||q.getStatus()==QueueItem.QueueStatus.WAITING)
      throw new ResponseStatusException(CONFLICT,"종료할 진행 중인 음성 상담이 없습니다.");
    if(q.getStatus()==QueueItem.QueueStatus.PROCESSING)q.endCall();
    return response(q);
  }

  @PostMapping("/session/{sessionId}/token")
  @Transactional
  public LiveKitService.LiveKitTokenResponse token(@PathVariable String sessionId) {
    var q = queues.lockSession(sessionId).orElseThrow(()->new ResponseStatusException(NOT_FOUND));requireSession(q);
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
    var result=new LinkedHashMap<String,Object>();result.putAll(Map.of(
        "sessionId",
        q.getSessionId(),
        "queueCode",
        q.getCode(),
        "status",
        q.getType()==QueueItem.ItemType.CALL && q.getStatus() == QueueItem.QueueStatus.PROCESSING && q.isCallEnded()
            ? "CALL_ENDED"
            : q.getStatus().name(),
        "assignedAgent",
        q.getAssignedAgent() == null ? "" : q.getAssignedAgent(),
        "channel",q.getType()==QueueItem.ItemType.CALL?"CALL":"CHAT",
        "waitingCount",count));
    result.put("expiresAt",q.getSupportExpiresAt());
    return result;
  }

  private Organization publicOrg(String code) {
    return organizations
        .findByPublicCodeAndActiveTrue(code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "상담 접수 조직을 찾을 수 없습니다."));
  }

  private QueueItem session(String id) {
    var q = queues.findBySessionId(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    requireSession(q);
    return q;
  }

  private void requireSession(QueueItem q) {
    if (q.getOrganizationId() == null
        || !organizations.findById(q.getOrganizationId()).map(Organization::isActive).orElse(false))
      throw new ResponseStatusException(NOT_FOUND);
    if(q.supportExpired(clock.instant()))throw new ResponseStatusException(GONE,"상담 접수 화면의 이용 시간이 만료되었습니다. 새 요청을 접수해 주세요.");
  }

  private String requestKey(String organizationId,String requestId){
    if(!requestId.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"))throw new ResponseStatusException(BAD_REQUEST);
    return UUID.nameUUIDFromBytes((organizationId+":"+UUID.fromString(requestId)).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
  }
  private String fingerprint(Request request){
    try{var value=json.<com.fasterxml.jackson.databind.node.ObjectNode>valueToTree(request);value.put("requestId",UUID.fromString(request.requestId()).toString());
      return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}
    catch(java.io.IOException|java.security.NoSuchAlgorithmException e){throw new IllegalStateException("Support request fingerprint unavailable",e);}
  }
}
