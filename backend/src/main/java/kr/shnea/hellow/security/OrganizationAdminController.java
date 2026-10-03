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
  private final kr.shnea.hellow.routing.RoutingLockRepository routingLock;
  private final WorkspaceAccess access;
  private final AdminAccess admin;
  private final OrganizationRepository organizations;
  private final MembershipRepository memberships;
  private final AuditEvents audit;
  private final AuditEventRepository events;
  private final kr.shnea.hellow.queue.QueueItemRepository queues;
  private final kr.shnea.hellow.followup.FollowUpRepository followups;
  private final kr.shnea.hellow.transfer.WorkTransferRepository transfers;
  public static final Set<String> PERMISSIONS = Set.of("organization:admin", "customer:read", "customer:write",
      "queue:read", "queue:accept", "consultation:read", "consultation:write", "consultation:transfer", "transfer:read", "followup:read", "followup:write", "followup:assign", "template:personal", "recording:read", "recording:manage", "agent:monitor", "report:read");
  public OrganizationAdminController(WorkspaceAccess access, AdminAccess admin, OrganizationRepository organizations,
      MembershipRepository memberships, AuditEvents audit, AuditEventRepository events,kr.shnea.hellow.routing.RoutingLockRepository routingLock,kr.shnea.hellow.queue.QueueItemRepository queues,kr.shnea.hellow.followup.FollowUpRepository followups,kr.shnea.hellow.transfer.WorkTransferRepository transfers) {
    this.routingLock=routingLock;this.access = access; this.admin = admin; this.organizations = organizations;
    this.memberships = memberships; this.audit = audit; this.events = events;this.queues=queues;this.followups=followups;this.transfers=transfers;
  }
  @GetMapping("/context")
  public Map<String, Object> context() { return Map.of("platformAdmin", admin.isPlatformAdmin(), "permissions", PERMISSIONS); }
  @GetMapping("/organizations")
  public List<Organization> list() {
    if (admin.isPlatformAdmin()) return organizations.findAll();
    var jwt = access.identity();
    return memberships.findByIssuerAndSubjectAndActiveTrue(jwt.getIssuer().toString(), jwt.getSubject()).stream()
        .filter(m -> access.authority().isAdmin(m))
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
  public List<MemberView> members() { return memberships.findByOrganizationIdOrderById(admin.organization()).stream().filter(m->!m.isDeleted())
      .map(m->new MemberView(m.getId(),m.getSubject(),m.getLoginId(),m.getDisplayName(),m.getPermissions(),m.isActive(),m.getVersion(),m.getTeamId(),m.getRoleIds(),m.getDataScope(),access.authority().grants(m))).toList(); }
  public record MemberView(Long id,String subject,String loginId,String displayName,Set<String> permissions,boolean active,Long version,String teamId,Set<String> roleIds,String dataScope,Map<String,DataScope> effectiveScopes){}
  public record MemberRequest(@NotBlank @Size(max = 255) String subject, @Size(max = 100) String displayName, @NotNull Set<String> permissions) {}
  public record MemberUpdate(@NotNull Long expectedVersion, @Size(max = 100) String displayName, @NotNull Set<String> permissions, boolean active) {}
  static void validatePermissions(Set<String> permissions) {
    if (permissions.stream().anyMatch(Objects::isNull)||!PERMISSIONS.containsAll(permissions)) throw new ResponseStatusException(BAD_REQUEST, "지원하지 않는 권한입니다.");
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
    if(r.permissions().contains("organization:admin")&&!"ORGANIZATION".equals(member.getDataScope()))
      throw new ResponseStatusException(BAD_REQUEST,"조직 관리 권한은 조직 전체 범위가 필요합니다. 접근 범위를 먼저 변경해 주세요.");
    member.update(r.displayName(), r.permissions(), r.active()); memberships.saveAndFlush(member);
    access.authority().protectAdministrators(org);
    audit.record(org, "MEMBER_CHANGED", member.getSubject(), "active=" + r.active() + "; permissions=" + String.join(",", new TreeSet<>(r.permissions())));
    return member;
  }
  @PostMapping("/memberships/{id}/revoke") @Transactional
  public void revoke(@PathVariable Long id) {
    String org = admin.lockOrganization();
    var member = ownedMember(id, org);
    member.revoke(); memberships.saveAndFlush(member);access.authority().protectAdministrators(org);
    audit.record(org, "MEMBER_REVOKED", member.getSubject(), "조직 접근 회수");
  }
  private Membership ownedMember(Long id, String org) {
    return memberships.findById(id).filter(m -> org.equals(m.getOrganizationId())&&!m.isDeleted())
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "직원을 찾을 수 없습니다."));
  }
  @GetMapping("/audit")
  public List<Map<String,Object>> audit() { return events.findTop100ByOrganizationIdOrderByOccurredAtDesc(admin.organization()).stream().map(this::auditView).toList(); }
  @GetMapping("/audit/common")
  public List<Map<String,Object>> commonAudit() { admin.requirePlatformAdmin(); return events.findTop100ByOrganizationIdIsNullOrderByOccurredAtDesc().stream().map(this::auditView).toList(); }
  private Map<String,Object> auditView(AuditEvent event){
    var result=new LinkedHashMap<String,Object>();result.put("id",event.getId());result.put("occurredAt",event.getOccurredAt());result.put("action",event.getAction());result.put("details",event.getDetails());result.put("target",event.getTarget());
    result.put("actorName",new StaffNames(memberships).resolve(event.getOrganizationId(),event.getActorIssuer(),event.getActorSubject(),null));return result;
  }
  @DeleteMapping("/memberships/{id}") @Transactional
  public void delete(@PathVariable Long id,@RequestParam Long expectedVersion){
    admin.organization();routingLock.acquire().orElseThrow();
    String org=admin.lockOrganization();var member=ownedMember(id,org);
    if(!Objects.equals(expectedVersion,member.getVersion()))throw new ResponseStatusException(CONFLICT,"직원 정보가 변경됐습니다. 다시 조회해 주세요.");
    if(queues.activeForIdentity(member.getIssuer(),member.getSubject()).stream().anyMatch(q->org.equals(q.getOrganizationId()))
        ||followups.activeForIdentity(member.getIssuer(),member.getSubject()).stream().anyMatch(f->org.equals(f.getOrganizationId()))
        ||transfers.reservations(member.getIssuer(),member.getSubject()).stream().anyMatch(t->org.equals(t.getOrganizationId())))throw new ResponseStatusException(CONFLICT,"진행 중인 상담·예약·이관을 마친 뒤 직원을 삭제해 주세요.");
    member.delete();memberships.saveAndFlush(member);access.authority().protectAdministrators(org);
    audit.record(org,"MEMBER_DELETED",String.valueOf(id),"조직 접근·직원 목록에서 삭제, 기존 업무 기록 보존");
  }
}
