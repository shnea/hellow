package kr.shnea.hellow.security;

import jakarta.persistence.*;

@MappedSuperclass
public abstract class OrganizationOwned {
  // Legacy rows remain quarantined (NULL) until an explicit audited migration.
  @Column(length = 64)
  private String organizationId;

  public String getOrganizationId() {
    return organizationId;
  }

  public void setOrganizationId(String id) {
    this.organizationId = id;
  }
}
