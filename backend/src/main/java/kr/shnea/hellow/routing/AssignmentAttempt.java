package kr.shnea.hellow.routing;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Delivery, ringing and final outcome belong to a routing attempt, not the consultation document. */
@Entity @Table(name="assignment_attempts")
public class AssignmentAttempt {
  public enum Outcome { OFFERED, RINGING, ACCEPTED, REJECTED, MISSED, TIMED_OUT, OFFLINE, REVOKED, ORGANIZATION_CHANGED, CANCELLED }
  @Id @Column(length=64) private String id;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false,length=64) private String queueCode;
  @Column(nullable=false,length=64) private String presenceId;
  @Column(nullable=false,length=255) private String agentIssuer;
  @Column(nullable=false,length=255) private String agentSubject;
  @Column(nullable=false,length=100) private String agentName;
  @Column(nullable=false) private int routingCycle;
  @Column(nullable=false) private Instant offeredAt;
  @Column(nullable=false) private Instant expiresAt;
  private Instant receivedAt;
  private Instant finishedAt;
  @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private Outcome outcome;
  @Version private Long version;
  protected AssignmentAttempt() {}
  AssignmentAttempt(String org,String code,int cycle,AgentPresence p,Instant now) {
    id=UUID.randomUUID().toString();organizationId=org;queueCode=code;routingCycle=cycle;
    presenceId=p.getId();agentIssuer=p.getIssuer();agentSubject=p.getSubject();agentName=p.getDisplayName();
    offeredAt=now;expiresAt=now.plusSeconds(30);outcome=Outcome.OFFERED;
  }
  public String getId(){return id;}
  public String getOrganizationId(){return organizationId;}
  public String getQueueCode(){return queueCode;}
  public String getPresenceId(){return presenceId;}
  public String getAgentIssuer(){return agentIssuer;}
  public String getAgentSubject(){return agentSubject;}
  public String getAgentName(){return agentName;}
  public int getRoutingCycle(){return routingCycle;}
  public Instant getOfferedAt(){return offeredAt;}
  public Instant getExpiresAt(){return expiresAt;}
  public Instant getReceivedAt(){return receivedAt;}
  public Instant getFinishedAt(){return finishedAt;}
  public Outcome getOutcome(){return outcome;}
  public boolean active(){return outcome==Outcome.OFFERED||outcome==Outcome.RINGING;}
  boolean belongsTo(String issuer,String subject){return agentIssuer.equals(issuer)&&agentSubject.equals(subject);}
  void received(Instant now){if(outcome==Outcome.OFFERED){receivedAt=now;outcome=Outcome.RINGING;}}
  void finish(Outcome outcome,Instant now){if(active()){this.outcome=outcome;finishedAt=now;}}
}
