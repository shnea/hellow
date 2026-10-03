package kr.shnea.hellow.transfer;
import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.security.WorkspaceAccess;
@Entity @Table(name="work_transfer_events")
public class WorkTransferEvent {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false,length=36) private String transferId;
  @Column(nullable=false,length=32) private String action;
  @Column(nullable=false,length=255) private String actorIssuer;
  @Column(nullable=false,length=255) private String actorSubject;
  @Column(nullable=false,length=255) private String actorName;
  @Column(nullable=false) private Instant occurredAt;
  @Column(nullable=false,length=2000) private String reason;
  protected WorkTransferEvent(){}
  WorkTransferEvent(WorkTransfer transfer,WorkspaceAccess.Actor actor,String action,String reason,Instant now){organizationId=transfer.getOrganizationId();transferId=transfer.getId();this.action=action;this.reason=reason;actorIssuer=actor.issuer();actorSubject=actor.subject();actorName=actor.name();occurredAt=now;}
  public Long getId(){return id;} public String getAction(){return action;} public String getReason(){return reason;} public String getActorName(){return actorName;} public Instant getOccurredAt(){return occurredAt;}
}
