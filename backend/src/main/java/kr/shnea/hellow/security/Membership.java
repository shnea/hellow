package kr.shnea.hellow.security;

import jakarta.persistence.*;
import java.util.Set;

@Entity
@Table(
    name = "memberships",
    uniqueConstraints = @UniqueConstraint(columnNames = {"organizationId", "issuer", "subject"}))
public class Membership {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String organizationId;

  @Column(nullable = false)
  private String subject;

  @Column(nullable = false)
  private String issuer;

  @Column(nullable = false)
  private boolean active;

  @Column(nullable = false)
  private String dataScope;

  @ElementCollection(fetch = FetchType.EAGER)
  private Set<String> permissions;

  protected Membership() {}

  public Membership(String organizationId, String issuer, String subject, Set<String> permissions) {
    this.issuer = issuer;
    this.organizationId = organizationId;
    this.subject = subject;
    this.permissions = permissions;
    this.active = true;
    this.dataScope = "ORGANIZATION";
  }

  public Long getId() {
    return id;
  }

  public String getOrganizationId() {
    return organizationId;
  }

  public String getSubject() {
    return subject;
  }

  public String getIssuer() {
    return issuer;
  }

  public void revoke() {
    this.active = false;
  }

  public boolean isActive() {
    return active;
  }

  public Set<String> getPermissions() {
    return permissions;
  }

  public String getDataScope() {
    return dataScope;
  }
}
