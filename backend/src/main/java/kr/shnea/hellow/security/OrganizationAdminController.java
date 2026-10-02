package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Platform onboarding never implicitly grants customer-data access to the platform administrator.
 */
@RestController
@RequestMapping("/api/admin")
public class OrganizationAdminController {
  private final WorkspaceAccess access;
  private final OrganizationRepository organizations;
  private final MembershipRepository memberships;
  private final String adminIssuer;
  private final String adminSubject;
  public static final Set<String> PERMISSIONS =
      Set.of(
          "organization:admin",
          "customer:read",
          "customer:write",
          "queue:read",
          "queue:accept",
          "consultation:read",
          "consultation:write",
          "followup:write");

  public OrganizationAdminController(
      WorkspaceAccess access,
      OrganizationRepository organizations,
      MembershipRepository memberships,
      @Value("${hellow.platform-admin-issuer:}") String adminIssuer,
      @Value("${hellow.platform-admin-subject:}") String adminSubject) {
    this.access = access;
    this.organizations = organizations;
    this.memberships = memberships;
    this.adminIssuer = adminIssuer;
    this.adminSubject = adminSubject;
  }

  public record OrganizationRequest(
      @NotBlank @Size(max = 150) String name, @NotBlank String initialAdminSubject) {}

  @PostMapping("/organizations")
  @Transactional
  public Organization create(@Valid @RequestBody OrganizationRequest r) {
    var jwt = access.identity();
    if (adminIssuer.isBlank()
        || adminSubject.isBlank()
        || !adminIssuer.equals(jwt.getIssuer().toString())
        || !adminSubject.equals(jwt.getSubject()))
      throw new ResponseStatusException(FORBIDDEN, "플랫폼 조직 생성 권한이 없습니다.");
    var org =
        new Organization(UUID.randomUUID().toString(), r.name(), UUID.randomUUID().toString());
    organizations.save(org);
    memberships.save(
        new Membership(
            org.getId(), jwt.getIssuer().toString(), r.initialAdminSubject(), PERMISSIONS));
    return org;
  }

  public record MemberRequest(@NotBlank String subject, @NotNull Set<String> permissions) {}

  @PostMapping("/memberships")
  @Transactional
  public Map<String, Long> add(@Valid @RequestBody MemberRequest r) {
    var actor = access.require("organization:admin");
    if (!PERMISSIONS.containsAll(r.permissions()))
      throw new ResponseStatusException(BAD_REQUEST, "지원하지 않는 권한입니다.");
    var member =
        memberships.save(
            new Membership(
                actor.organizationId(),
                access.identity().getIssuer().toString(),
                r.subject(),
                r.permissions()));
    return Map.of("id", member.getId());
  }

  @PostMapping("/memberships/{id}/revoke")
  @Transactional
  public void revoke(@PathVariable Long id) {
    var actor = access.require("organization:admin");
    var member =
        memberships
            .findById(id)
            .filter(m -> actor.organizationId().equals(m.getOrganizationId()))
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    if (member.getPermissions().contains("organization:admin"))
      throw new ResponseStatusException(CONFLICT, "관리자 회수는 대체 관리자 보호 절차가 필요합니다.");
    member.revoke();
    memberships.save(member);
  }
}
