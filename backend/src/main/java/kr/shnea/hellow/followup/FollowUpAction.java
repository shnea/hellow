package kr.shnea.hellow.followup;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.Instant;
import kr.shnea.hellow.security.WorkspaceAccess;

@Entity
@Table(name = "follow_up_actions")
public class FollowUpAction extends kr.shnea.hellow.security.OrganizationOwned {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 64)
  private String customerCode;

  @Column(nullable = false, length = 50)
  private String actionType; // VISIT, CALLBACK, TRANSFER, NOTIFICATION

  @Column(nullable = false, length = 200)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String details;

  @Column(nullable = false, length = 32)
  private String status; // PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED

  @Version private Long version;
  private Instant proposedAt;
  private Instant scheduledAt;
  private Instant scheduledEndAt;
  @Column(length=100) private String timeZone;
  private Integer durationMinutes;
  private Long assignedMemberId;
  @Column(length=255) private String assignedName;
  @Column(length=255) private String creatorIssuer;
  @Column(length=255) private String creatorSubject;
  @Column(length=255) private String creatorName;
  private Instant updatedAt;
  private Instant startedAt;
  private Instant finishedAt;
  @Column(columnDefinition="TEXT") private String outcome;
  @com.fasterxml.jackson.annotation.JsonIgnore @Column(length=64,unique=true) private String requestKey;
  @com.fasterxml.jackson.annotation.JsonIgnore @Column(length=64) private String requestFingerprint;

  private LocalDateTime createdAt;

  @Column(length = 64)
  private String queueCode;

  public String getQueueCode() {
    return queueCode;
  }

  public void setQueueCode(String code) {
    this.queueCode = code;
  }

  protected FollowUpAction() {}

  public FollowUpAction(String customerCode, String actionType, String title, String details) {
    this.customerCode = customerCode;
    this.actionType = actionType;
    this.title = title;
    this.details = details;
    this.status = "PENDING";
    this.createdAt = LocalDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getCustomerCode() {
    return customerCode;
  }
  public void associateCustomer(String code){this.customerCode=code;}

  public String getActionType() {
    return actionType;
  }

  public String getTitle() {
    return title;
  }

  public String getDetails() {
    return details;
  }

  public String getStatus() {
    return status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public Long getVersion(){return version;}
  public Instant getProposedAt(){return proposedAt;}
  public Instant getScheduledAt(){return scheduledAt;}
  public Instant getScheduledEndAt(){return scheduledEndAt;}
  public String getTimeZone(){return timeZone;}
  public Integer getDurationMinutes(){return durationMinutes;}
  public Long getAssignedMemberId(){return assignedMemberId;}
  public String getAssignedName(){return assignedName;}
  public String getCreatorIssuer(){return creatorIssuer;}
  public String getCreatorSubject(){return creatorSubject;}
  public String getCreatorName(){return creatorName;}
  public Instant getUpdatedAt(){return updatedAt;}
  public Instant getStartedAt(){return startedAt;}
  public Instant getFinishedAt(){return finishedAt;}
  public String getOutcome(){return outcome;}
  String fingerprint(){return requestFingerprint;}
  void initialize(WorkspaceAccess.Actor actor,Instant now,Instant proposed,String zone,String key,String fingerprint){
    creatorIssuer=actor.issuer();creatorSubject=actor.subject();creatorName=actor.name();
    createdAt=LocalDateTime.ofInstant(now,java.time.ZoneId.of("Asia/Seoul"));updatedAt=now;
    proposedAt=proposed;timeZone=zone;requestKey=key;requestFingerprint=fingerprint;
  }
  void edit(String title,String details,Instant now){this.title=title;this.details=details;updatedAt=now;}
  void assign(WorkspaceAccess.Actor assignee,Long memberId,Instant now){
    assignOwner(assignee);assignedMemberId=memberId;assignedName=assignee.name();updatedAt=now;
    if(!"SCHEDULED".equals(status))status="ASSIGNED";
  }
  void schedule(WorkspaceAccess.Actor assignee,Long memberId,Instant at,int minutes,String zone,Instant now){
    assignOwner(assignee);assignedMemberId=memberId;assignedName=assignee.name();
    scheduledAt=at;scheduledEndAt=at.plusSeconds(minutes*60L);durationMinutes=minutes;timeZone=zone;
    status="SCHEDULED";outcome=null;startedAt=null;finishedAt=null;updatedAt=now;
  }
  void transition(String status,String outcome,Instant now){
    this.status=status;this.outcome=outcome;updatedAt=now;
    if("IN_PROGRESS".equals(status))startedAt=now;
    else finishedAt=now;
  }
}
