package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

/** Administrative access never bypasses WorkspaceAccess for customer or media data. */
@Component
public class AdminAccess {
  private final WorkspaceAccess workspace;
  private final OrganizationRepository organizations;
  private final String issuer;
  private final String subject;
  public AdminAccess(WorkspaceAccess workspace, OrganizationRepository organizations,
      @Value("${hellow.platform-admin-issuer:}") String issuer,
      @Value("${hellow.platform-admin-subject:}") String subject) {
    this.workspace = workspace; this.organizations = organizations; this.issuer = issuer; this.subject = subject;
  }
  public boolean isPlatformAdmin() {
    var jwt = workspace.identity();
    return !issuer.isBlank() && !subject.isBlank() && issuer.equals(jwt.getIssuer().toString()) && subject.equals(jwt.getSubject());
  }
  public void requirePlatformAdmin() {
    if (!isPlatformAdmin()) throw new ResponseStatusException(FORBIDDEN, "최고관리자 권한이 없습니다.");
  }
  public String organization() {
    return organization(false);
  }
  public String lockOrganization() {
    return organization(true);
  }
  private String organization(boolean lock) {
    String id = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest().getHeader("X-Organization-ID");
    if (id == null || id.isBlank()) throw new ResponseStatusException(BAD_REQUEST, "대상 조직을 선택해 주세요.");
    // Acquire the organization lock before loading the acting Membership. This
    // prevents concurrent administrator removals from authorizing on stale state.
    if (lock) organizations.lockById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "조직을 찾을 수 없습니다."));
    else if (!organizations.existsById(id)) throw new ResponseStatusException(NOT_FOUND, "조직을 찾을 수 없습니다.");
    if (!isPlatformAdmin()) workspace.require("organization:admin");
    return id;
  }
}
