package kr.shnea.hellow.collaboration;

import static org.springframework.http.HttpStatus.NOT_FOUND;

import jakarta.persistence.EntityManager;
import kr.shnea.hellow.security.OrganizationRepository;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Serialize collaboration commands with organization membership and role changes. */
@Component
public class CollaborationAccess {
  private final WorkspaceAccess access;
  private final OrganizationRepository organizations;
  private final EntityManager entities;

  public CollaborationAccess(
      WorkspaceAccess access, OrganizationRepository organizations, EntityManager entities) {
    this.access = access;
    this.organizations = organizations;
    this.entities = entities;
  }

  public WorkspaceAccess.Actor command(String permission) {
    var initial = access.require(permission);
    organizations
        .lockById(initial.organizationId())
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    // The initial authorization may have waited behind a committed access change.
    entities.clear();
    return access.require(permission);
  }
}
