package kr.shnea.hellow.security;
import static org.springframework.http.HttpStatus.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/session")
public class SessionAuditController {
  private final WorkspaceAccess access;
  private final MembershipRepository memberships;
  private final OrganizationRepository organizations;
  private final AuditEvents audit;
  private final kr.shnea.hellow.routing.RoutingService routing;
  public SessionAuditController(WorkspaceAccess access, MembershipRepository memberships, OrganizationRepository organizations, AuditEvents audit,kr.shnea.hellow.routing.RoutingService routing) {
    this.access = access; this.memberships = memberships; this.organizations = organizations; this.audit = audit;this.routing=routing;
  }
  @PostMapping("/{action:login|logout}") @Transactional
  public void session(@PathVariable String action) {
    var jwt = access.identity();
    if(action.equals("logout"))routing.logout(jwt.getIssuer().toString(),jwt.getSubject());
    audit.record(null, "CRM_" + action.toUpperCase(java.util.Locale.ROOT), jwt.getSubject(), "CRM 세션 " + action);
    memberships.findByIssuerAndSubjectAndActiveTrue(jwt.getIssuer().toString(), jwt.getSubject()).forEach(
        m -> audit.record(m.getOrganizationId(), "CRM_" + action.toUpperCase(java.util.Locale.ROOT), jwt.getSubject(), "CRM 세션 " + action));
  }
  @PostMapping("/organization") @Transactional
  public void enter(@RequestHeader("X-Organization-ID") String org) {
    var jwt = access.identity();
    if (memberships.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(org, jwt.getIssuer().toString(), jwt.getSubject()).isEmpty()
        || !organizations.findById(org).map(Organization::isActive).orElse(false))
      throw new ResponseStatusException(FORBIDDEN, "활성 조직 권한이 없습니다.");
    audit.record(org, "CRM_ORGANIZATION_ENTER", org, "조직 진입");
  }
}
