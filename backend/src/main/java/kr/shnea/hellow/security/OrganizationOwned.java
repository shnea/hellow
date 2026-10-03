package kr.shnea.hellow.security;

import jakarta.persistence.*;

@MappedSuperclass
public abstract class OrganizationOwned {
  // Legacy rows remain quarantined (NULL) until an explicit audited migration.
  @Column(length = 64)
  private String organizationId;
  @Column(length=255) private String ownerIssuer;
  @Column(length=255) private String ownerSubject;
  @Column(length=64) private String teamId;

  public String getOwnerIssuer(){return ownerIssuer;}
  public String getOwnerSubject(){return ownerSubject;}
  public String getTeamId(){return teamId;}
  public void assignOwner(WorkspaceAccess.Actor actor) {
    ownerIssuer=actor.issuer();ownerSubject=actor.subject();teamId=actor.teamId();
  }
  public void copyOwner(OrganizationOwned row) {ownerIssuer=row.ownerIssuer;ownerSubject=row.ownerSubject;teamId=row.teamId;}

  public String getOrganizationId() {
    return organizationId;
  }

  public void setOrganizationId(String id) {
    this.organizationId = id;
  }
}
