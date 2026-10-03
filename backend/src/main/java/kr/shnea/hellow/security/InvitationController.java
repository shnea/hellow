package kr.shnea.hellow.security;
import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class InvitationController {
  @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
  private final AdminAccess admin;
  private final WorkspaceAccess access;
  private final OrganizationRepository organizations;
  private final MembershipRepository memberships;
  private final OrganizationInvitationRepository invitations;
  private final AuditEvents audit;
  public InvitationController(AdminAccess admin, WorkspaceAccess access, OrganizationRepository organizations,
      MembershipRepository memberships, OrganizationInvitationRepository invitations, AuditEvents audit) {
    this.admin = admin; this.access = access; this.organizations = organizations;
    this.memberships = memberships; this.invitations = invitations; this.audit = audit;
  }
  public record InviteRequest(@NotBlank @Email @Size(max = 254) String email, @NotNull Set<String> permissions) {}
  @GetMapping("/api/admin/invitations")
  public List<OrganizationInvitation> list() { return invitations.findByOrganizationIdOrderByExpiresAtDesc(admin.organization()); }
  @PostMapping("/api/admin/invitations") @Transactional
  public Map<String, String> create(@Valid @RequestBody InviteRequest r) {
    String org = admin.lockOrganization();
    OrganizationAdminController.validatePermissions(r.permissions());
    String email = r.email().trim().toLowerCase(Locale.ROOT);
    for (var prior : invitations.findByOrganizationIdOrderByExpiresAtDesc(org))
      if (prior.getRecipientEmail().equals(email) && prior.getAcceptedSubject() == null) prior.cancel();
    byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    var invite = new OrganizationInvitation(UUID.randomUUID().toString(), org,
        access.identity().getIssuer().toString(), email, hash(token), r.permissions());
    invitations.save(invite); audit.record(org, "INVITATION_CREATED", invite.getId(), "직원 초대 링크 생성");
    return Map.of("id", invite.getId(), "path", "/invite?token=" + token, "expiresAt", invite.getExpiresAt().toString());
  }
  @PostMapping("/api/admin/invitations/{id}/cancel") @Transactional
  public void cancel(@PathVariable String id) {
    String org = admin.lockOrganization();
    var invite = invitations.findById(id).filter(i -> org.equals(i.getOrganizationId()))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    if (invite.getAcceptedSubject() != null) throw new ResponseStatusException(CONFLICT, "이미 수락된 초대입니다. 직원 권한에서 관리해 주세요.");
    invite.cancel(); audit.record(org, "INVITATION_CANCELLED", id, "초대 취소");
  }
  public record AcceptRequest(@NotBlank @Size(max = 100) String token) {}
  @PostMapping("/api/invitations/accept") @Transactional
  public Map<String, String> accept(@Valid @RequestBody AcceptRequest r) {
    String tokenHash = hash(r.token());
    var invite = invitations.findByTokenHash(tokenHash).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "유효한 초대가 아닙니다."));
    var org = organizations.lockById(invite.getOrganizationId()).filter(Organization::isActive)
        .orElseThrow(() -> new ResponseStatusException(CONFLICT, "현재 가입할 수 없는 조직입니다."));
    // Re-read under the organization lock to serialize acceptance, cancellation and re-invites.
    entityManager.refresh(invite);
    var jwt = access.identity();
    if (!invite.getIssuer().equals(jwt.getIssuer().toString()) || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
        || !invite.getRecipientEmail().equalsIgnoreCase(Optional.ofNullable(jwt.getClaimAsString("email")).orElse("")))
      throw new ResponseStatusException(FORBIDDEN, "초대받은 이메일이 인증된 플랫폼 계정으로 로그인해 주세요.");
    if (invite.isCancelled() || !invite.getExpiresAt().isAfter(Instant.now()))
      throw new ResponseStatusException(CONFLICT, "취소되거나 만료된 초대입니다. 관리자에게 새 초대를 요청해 주세요.");
    if (invite.getAcceptedSubject() != null) {
      if (!invite.getAcceptedSubject().equals(jwt.getSubject()) || memberships.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
          org.getId(), jwt.getIssuer().toString(), jwt.getSubject()).isEmpty())
        throw new ResponseStatusException(CONFLICT, "이미 사용된 초대입니다.");
      return Map.of("organizationId", org.getId(), "name", org.getName());
    }
    if (memberships.findByOrganizationIdAndIssuerAndSubject(org.getId(), jwt.getIssuer().toString(), jwt.getSubject()).isPresent())
      throw new ResponseStatusException(CONFLICT, "이미 등록된 계정입니다. 조직 관리자에게 권한 확인을 요청해 주세요.");
    var member = new Membership(org.getId(), jwt.getIssuer().toString(), jwt.getSubject(), invite.getPermissions());
    member.update(jwt.getClaimAsString("name"), invite.getPermissions(), true); memberships.save(member);
    invite.accept(jwt.getSubject()); audit.record(org.getId(), "INVITATION_ACCEPTED", invite.getId(), "직원 가입");
    return Map.of("organizationId", org.getId(), "name", org.getName());
  }
  private static String hash(String token) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
    catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
  }
}
