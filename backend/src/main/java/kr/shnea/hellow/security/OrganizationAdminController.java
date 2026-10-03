package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
public class OrganizationAdminController {
  private final WorkspaceAccess access;
  private final AdminAccess admin;
  private final OrganizationRepository organizations;
  private final MembershipRepository memberships;
  private final AuditEvents audit;
  private final AuditEventRepository events;
  public static final Set<String> PERMISSIONS = Set.of("organization:admin", "customer:read", "customer:write",
      "queue:read", "queue:accept", "consultation:read", "consultation:write", "followup:write");
  public OrganizationAdminController(WorkspaceAccess access, AdminAccess admin, OrganizationRepository organizations,
      MembershipRepository memberships, AuditEvents audit, AuditEventRepository events) {
    this.access = access; this.admin = admin; this.organizations = organizations;
    this.memberships = memberships; this.audit = audit; this.events = events;
  }
  @GetMapping("/context")
  public Map<String, Object> context() { return Map.of("platformAdmin", admin.isPlatformAdmin(), "permissions", PERMISSIONS); }
  @GetMapping("/organizations")
  public List<Organization> list() {
    if (admin.isPlatformAdmin()) return organizations.findAll();
    var jwt = access.identity();
    return memberships.findByIssuerAndSubjectAndActiveTrue(jwt.getIssuer().toString(), jwt.getSubject()).stream()
        .filter(m -> "ORGANIZATION".equals(m.getDataScope()) && m.getPermissions().contains("organization:admin"))
        .flatMap(m -> organizations.findById(m.getOrganizationId()).filter(Organization::isActive).stream()).toList();
  }
  public record OrganizationRequest(@NotBlank @Size(max = 150) String name, @NotBlank @Size(max = 255) String initialAdminSubject) {}
  @PostMapping("/organizations") @Transactional
  public Organization create(@Valid @RequestBody OrganizationRequest r) {
    admin.requirePlatformAdmin();
    var org = new Organization(UUID.randomUUID().toString(), r.name().trim(), UUID.randomUUID().toString());
    organizations.save(org);
    memberships.save(new Membership(org.getId(), access.identity().getIssuer().toString(), r.initialAdminSubject(), PERMISSIONS));
    audit.record(org.getId(), "ORGANIZATION_CREATED", org.getId(), "조직과 최초 관리자 지정");
    return org;
  }
  @GetMapping("/memberships")
  public List<Membership> members() { return memberships.findByOrganizationIdOrderById(admin.organization()); }
  public record MemberRequest(@NotBlank @Size(max = 255) String subject, @Size(max = 100) String displayName, @NotNull Set<String> permissions) {}
  public record MemberUpdate(@NotNull Long expectedVersion, @Size(max = 100) String displayName, @NotNull Set<String> permissions, boolean active) {}
  static void validatePermissions(Set<String> permissions) {
    if (!PERMISSIONS.containsAll(permissions)) throw new ResponseStatusException(BAD_REQUEST, "지원하지 않는 권한입니다.");
  }
  @PostMapping("/memberships") @Transactional
  public Map<String, Long> add(@Valid @RequestBody MemberRequest r) {
    String org = admin.lockOrganization();
    validatePermissions(r.permissions());
    String issuer = access.identity().getIssuer().toString();
    if (memberships.findByOrganizationIdAndIssuerAndSubject(org, issuer, r.subject()).isPresent())
      throw new ResponseStatusException(CONFLICT, "이미 등록된 직원입니다. 기존 직원에서 변경해 주세요.");
    var member = new Membership(org, issuer, r.subject(), r.permissions());
    member.update(r.displayName(), r.permissions(), true); memberships.save(member);
    audit.record(org, "MEMBER_ADDED", r.subject(), String.join(",", new TreeSet<>(r.permissions())));
    return Map.of("id", member.getId());
  }
  @PutMapping("/memberships/{id}") @Transactional
  public Membership update(@PathVariable Long id, @Valid @RequestBody MemberUpdate r) {
    String org = admin.lockOrganization();
    var member = ownedMember(id, org);
    if (!Objects.equals(member.getVersion(), r.expectedVersion()))
      throw new ResponseStatusException(CONFLICT, "직원 정보가 변경됐습니다. 다시 조회해 주세요.");
    validatePermissions(r.permissions());
    protectLastAdmin(member, r.active() && r.permissions().contains("organization:admin"));
    member.update(r.displayName(), r.permissions(), r.active()); memberships.saveAndFlush(member);
    audit.record(org, "MEMBER_CHANGED", member.getSubject(), "active=" + r.active() + "; permissions=" + String.join(",", new TreeSet<>(r.permissions())));
    return member;
  }
  @PostMapping("/memberships/{id}/revoke") @Transactional
  public void revoke(@PathVariable Long id) {
    String org = admin.lockOrganization();
    var member = ownedMember(id, org); protectLastAdmin(member, false);
    member.revoke(); memberships.save(member);
    audit.record(org, "MEMBER_REVOKED", member.getSubject(), "조직 접근 회수");
  }
  private Membership ownedMember(Long id, String org) {
    return memberships.findById(id).filter(m -> org.equals(m.getOrganizationId()))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "직원을 찾을 수 없습니다."));
  }
  private void protectLastAdmin(Membership member, boolean remainsAdmin) {
    if (member.isActive() && member.getPermissions().contains("organization:admin") && !remainsAdmin
        && memberships.findByOrganizationIdOrderById(member.getOrganizationId()).stream()
            .noneMatch(m -> !m.getId().equals(member.getId()) && m.isActive() && m.getPermissions().contains("organization:admin")))
      throw new ResponseStatusException(CONFLICT, "마지막 관리자는 해제할 수 없습니다. 다른 관리자를 먼저 지정해 주세요.");
  }
  @GetMapping("/audit")
  public List<AuditEvent> audit() { return events.findTop100ByOrganizationIdOrderByOccurredAtDesc(admin.organization()); }
  @GetMapping("/audit/common")
  public List<AuditEvent> commonAudit() { admin.requirePlatformAdmin(); return events.findTop100ByOrganizationIdIsNullOrderByOccurredAtDesc(); }
}
