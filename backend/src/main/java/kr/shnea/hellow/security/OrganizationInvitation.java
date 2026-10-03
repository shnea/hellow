package kr.shnea.hellow.security;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Set;
@Entity @Table(name = "organization_invitations")
public class OrganizationInvitation {
  @Id private String id;
  @Column(nullable = false) private String organizationId;
  @Column(nullable = false) private String issuer;
  @Column(nullable = false) private String recipientEmail;
  @Column(nullable = false, unique = true) private String tokenHash;
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "invitation_permissions", joinColumns = @JoinColumn(name = "invitation_id"))
  @Column(name = "permission") private Set<String> permissions;
  @Column(nullable = false) private Instant expiresAt;
  private boolean cancelled;
  private String acceptedSubject;
  protected OrganizationInvitation() {}
  public OrganizationInvitation(String id, String org, String issuer, String email, String hash, Set<String> permissions) {
    this.id = id; this.organizationId = org; this.issuer = issuer; this.recipientEmail = email;
    this.tokenHash = hash; this.permissions = permissions; this.expiresAt = Instant.now().plusSeconds(7 * 86400);
  }
  public String getId() { return id; }
  public String getOrganizationId() { return organizationId; }
  public String getIssuer() { return issuer; }
  public String getRecipientEmail() { return recipientEmail; }
  public Set<String> getPermissions() { return permissions; }
  public Instant getExpiresAt() { return expiresAt; }
  public boolean isCancelled() { return cancelled; }
  public String getAcceptedSubject() { return acceptedSubject; }
  public void cancel() { cancelled = true; }
  public void accept(String subject) { acceptedSubject = subject; }
}
