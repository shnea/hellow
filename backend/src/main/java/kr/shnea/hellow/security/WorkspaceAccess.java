package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

@Component
public class WorkspaceAccess {
  private final MembershipRepository memberships;
  private final OrganizationRepository organizations;
  private final MembershipAccess authority;

  public WorkspaceAccess(MembershipRepository memberships, OrganizationRepository organizations, MembershipAccess authority) {
    this.memberships = memberships;
    this.organizations = organizations;
    this.authority = authority;
  }

  public Jwt identity() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt))
      throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다.");
    return jwt;
  }

  public Actor require(String permission) {
    var request =
        ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
    String organizationId = request.getHeader("X-Organization-ID");
    if (organizationId == null) throw new ResponseStatusException(FORBIDDEN, "업무 조직을 선택해 주세요.");
    Jwt jwt = identity();
    var member =
        memberships
            .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
                organizationId, jwt.getIssuer().toString(), jwt.getSubject())
            .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "활성 조직 권한이 없습니다."));
    var grants=authority.grants(member);
    if (!organizations.findById(organizationId).map(Organization::isActive).orElse(false)
        || !grants.containsKey(permission))
      throw new ResponseStatusException(FORBIDDEN, "이 작업의 권한이 없습니다.");
    String name = jwt.getClaimAsString("name");
    return new Actor(organizationId, jwt.getSubject(), name == null ? jwt.getSubject() : name,
        jwt.getIssuer().toString(), member.getTeamId(), grants.get(permission), authority.teamScope(member), grants);
  }

  public record Actor(String organizationId, String subject, String name, String issuer,
      String teamId, DataScope dataScope, java.util.Set<String> teamIds, java.util.Map<String,DataScope> grants) {
    public boolean allows(OrganizationOwned row) {
      return organizationId.equals(row.getOrganizationId()) && (dataScope==DataScope.ORGANIZATION
        || issuer.equals(row.getOwnerIssuer())&&subject.equals(row.getOwnerSubject())
        || dataScope==DataScope.TEAM&&row.getTeamId()!=null&&teamIds.contains(row.getTeamId()));
    }
    public void requireRow(OrganizationOwned row) {
      if(!allows(row))throw new ResponseStatusException(NOT_FOUND,"접근할 수 있는 기록이 없습니다.");
    }
  }
  public MembershipAccess authority(){return authority;}
}
