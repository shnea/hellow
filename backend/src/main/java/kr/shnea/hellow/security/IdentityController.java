package kr.shnea.hellow.security;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class IdentityController {
  private final WorkspaceAccess access;
  private final MembershipRepository memberships;
  private final OrganizationRepository organizations;
  private final AdminAccess admin;
  private final MembershipIdentityLinker linker;

  public IdentityController(
      WorkspaceAccess access,
      MembershipRepository memberships,
      OrganizationRepository organizations, AdminAccess admin,MembershipIdentityLinker linker) {
    this.access = access;
    this.memberships = memberships;
    this.organizations = organizations;
    this.admin = admin;
    this.linker=linker;
  }

  @GetMapping("/api/me")
  public Map<String, Object> me() {
    var jwt = access.identity();
    linker.link(jwt);
    var orgs =
        memberships
            .findByIssuerAndSubjectAndActiveTrue(jwt.getIssuer().toString(), jwt.getSubject())
            .stream()
            .flatMap(
                m ->
                    organizations
                        .findById(m.getOrganizationId())
                        .filter(Organization::isActive)
                        .stream()
                        .map(
                            o ->
                                Map.of(
                                    "id",
                                    o.getId(),
                                    "name",
                                    o.getName(),
                                    "publicCode", o.getPublicCode(),
                                    "permissions",
                                    access.authority().grants(m).keySet(),
                                    "scopes", access.authority().grants(m),
                                    "teamId", Optional.ofNullable(m.getTeamId()).orElse(""))))
            .toList();
    return Map.of(
        "issuer", jwt.getIssuer().toString(),
        "subject",
        jwt.getSubject(),
        "name",
        Optional.ofNullable(jwt.getClaimAsString("name")).orElse(jwt.getSubject()),
        "organizations",
        orgs, "platformAdmin", admin.isPlatformAdmin());
  }
}
