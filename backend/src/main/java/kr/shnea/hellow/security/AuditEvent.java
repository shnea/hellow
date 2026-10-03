package kr.shnea.hellow.security;
import jakarta.persistence.*;
import java.time.Instant;
@Entity
@Table(name = "audit_events", indexes = @Index(columnList = "organizationId,occurredAt"))
public class AuditEvent {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  private String organizationId;
  @Column(nullable = false) private String actorIssuer;
  @Column(nullable = false) private String actorSubject;
  @Column(nullable = false) private String action;
  private String target;
  @Column(length = 6000) private String details;
  @Column(nullable = false) private Instant occurredAt;
  protected AuditEvent() {}
  public AuditEvent(String organizationId, String issuer, String subject, String action, String target, String details) {
    this.organizationId = organizationId; this.actorIssuer = issuer; this.actorSubject = subject;
    this.action = action; this.target = target; this.details = details; this.occurredAt = Instant.now();
  }
  public Long getId() { return id; }
  public String getOrganizationId() { return organizationId; }
  public String getActorIssuer() { return actorIssuer; }
  public String getActorSubject() { return actorSubject; }
  public String getAction() { return action; }
  public String getTarget() { return target; }
  public String getDetails() { return details; }
  public Instant getOccurredAt() { return occurredAt; }
}
