package kr.shnea.hellow.followup;
import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.security.WorkspaceAccess;
/** Append-only history. Authorization uses the current task rather than a copied ACL. */
@Entity @Table(name="follow_up_events")
public class FollowUpEvent {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false) private Long followUpId;
  @Column(nullable=false,length=32) private String action;
  @Column(nullable=false,length=255) private String actorIssuer;
  @Column(nullable=false,length=255) private String actorSubject;
  @Column(nullable=false,length=255) private String actorName;
  @Column(nullable=false) private Instant occurredAt;
  @Column(nullable=false,length=2000) private String reason;
  @Column(columnDefinition="TEXT") private String beforeSnapshot;
  @Column(nullable=false,columnDefinition="TEXT") private String afterSnapshot;
  protected FollowUpEvent(){}
  FollowUpEvent(FollowUpAction task,WorkspaceAccess.Actor actor,String action,String reason,String before,String after,Instant now){
    organizationId=task.getOrganizationId();followUpId=task.getId();this.action=action;
    actorIssuer=actor.issuer();actorSubject=actor.subject();actorName=actor.name();occurredAt=now;
    this.reason=reason;beforeSnapshot=before;afterSnapshot=after;
  }
  public Long getId(){return id;}
  public String getAction(){return action;}
  public String getActorIssuer(){return actorIssuer;}
  public String getActorSubject(){return actorSubject;}
  public String getActorName(){return actorName;}
  public Instant getOccurredAt(){return occurredAt;}
  public String getReason(){return reason;}
  public String getBeforeSnapshot(){return beforeSnapshot;}
  public String getAfterSnapshot(){return afterSnapshot;}
}
