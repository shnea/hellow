package kr.shnea.hellow.security;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class IdentityController {
  private final WorkspaceAccess access;
  private final MembershipRepository memberships;
  private final OrganizationRepository organizations;
  private final AdminAccess admin;

  public IdentityController(
      WorkspaceAccess access,
      MembershipRepository memberships,
      OrganizationRepository organizations, AdminAccess admin) {
    this.access = access;
    this.memberships = memberships;
    this.organizations = organizations;
    this.admin = admin;
  }

  @GetMapping("/api/me")
  public Map<String, Object> me() {
    var jwt = access.identity();
    var orgs =
        memberships
            .findByIssuerAndSubjectAndActiveTrue(jwt.getIssuer().toString(), jwt.getSubject())
            .stream()
            .filter(m -> "ORGANIZATION".equals(m.getDataScope()))
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
                                    m.getPermissions())))
            .toList();
    return Map.of(
        "subject",
        jwt.getSubject(),
        "name",
        Optional.ofNullable(jwt.getClaimAsString("name")).orElse(jwt.getSubject()),
        "organizations",
        orgs, "platformAdmin", admin.isPlatformAdmin());
  }
}
