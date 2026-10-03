package kr.shnea.hellow.transfer;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import kr.shnea.hellow.consultation.Consultation;
import kr.shnea.hellow.security.*;

/** A proposal never changes the record's owner. Acceptance is an atomic CRM command. */
@Entity @Table(name="work_transfers")
public class WorkTransfer extends OrganizationOwned {
  public enum Status {OFFERED,ACCEPTED,REJECTED,CANCELLED,EXPIRED,FAILED,REVOKED}
  @Id @Column(length=36) private String id;
  @Version private Long version;
  @Column(nullable=false) private Long consultationId;
  @Column(length=64) private String queueCode;
  @Column(nullable=false) private long recordVersion;
  @Column(nullable=false) private boolean liveWork;
  @Column(nullable=false) private Long fromMemberId;
  @Column(nullable=false,length=255) private String fromIssuer;
  @Column(nullable=false,length=255) private String fromSubject;
  @Column(nullable=false,length=255) private String fromName;
  @Column(nullable=false) private Long toMemberId;
  @Column(nullable=false,length=255) private String toIssuer;
  @Column(nullable=false,length=255) private String toSubject;
  @Column(nullable=false,length=255) private String toName;
  @Column(length=64) private String toTeamId;
  @Column(nullable=false,length=255) private String requesterIssuer;
  @Column(nullable=false,length=255) private String requesterSubject;
  @Column(nullable=false,length=255) private String requesterName;
  @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private Status status;
  @Column(nullable=false,length=2000) private String reason;
  @Column(nullable=false,columnDefinition="TEXT") private String memo;
  @Column(nullable=false) private Instant requestedAt;
  @Column(nullable=false) private Instant expiresAt;
  private Instant finishedAt;
  @Column(length=2000) private String outcome;
  @com.fasterxml.jackson.annotation.JsonIgnore @Column(nullable=false,unique=true,length=64) private String requestKey;
  @com.fasterxml.jackson.annotation.JsonIgnore @Column(nullable=false,length=64) private String requestFingerprint;
  protected WorkTransfer(){}
  public WorkTransfer(Consultation record,Membership from,Membership to,WorkspaceAccess.Actor requester,String reason,String memo,String key,String fingerprint,Instant now,Instant expires,boolean liveWork){
    id=UUID.randomUUID().toString();setOrganizationId(record.getOrganizationId());copyOwner(record);
    consultationId=record.getId();queueCode=record.getQueueCode();recordVersion=record.getVersion();
    this.liveWork=liveWork;
    fromMemberId=from.getId();fromIssuer=from.getIssuer();fromSubject=from.getSubject();fromName=name(from);
    toMemberId=to.getId();toIssuer=to.getIssuer();toSubject=to.getSubject();toName=name(to);toTeamId=to.getTeamId();
    requesterIssuer=requester.issuer();requesterSubject=requester.subject();requesterName=requester.name();
    status=Status.OFFERED;this.reason=reason;this.memo=memo;requestKey=key;requestFingerprint=fingerprint;requestedAt=now;expiresAt=expires;
  }
  private static String name(Membership member){return member.getDisplayName()==null?member.getSubject():member.getDisplayName();}
  void finish(Status state,String outcome,Instant now){if(status!=Status.OFFERED)throw new IllegalStateException("Transfer already finished");status=state;this.outcome=outcome;finishedAt=now;}
  String fingerprint(){return requestFingerprint;}
  public String getId(){return id;} public Long getVersion(){return version;}
  public Long getConsultationId(){return consultationId;} public String getQueueCode(){return queueCode;}
  public long getRecordVersion(){return recordVersion;} public Long getFromMemberId(){return fromMemberId;}
  public boolean isLiveWork(){return liveWork;}
  public String getFromIssuer(){return fromIssuer;} public String getFromSubject(){return fromSubject;} public String getFromName(){return fromName;}
  public Long getToMemberId(){return toMemberId;} public String getToIssuer(){return toIssuer;} public String getToSubject(){return toSubject;} public String getToName(){return toName;} public String getToTeamId(){return toTeamId;}
  public String getRequesterIssuer(){return requesterIssuer;} public String getRequesterSubject(){return requesterSubject;} public String getRequesterName(){return requesterName;}
  public Status getStatus(){return status;} public String getReason(){return reason;} public String getMemo(){return memo;}
  public Instant getRequestedAt(){return requestedAt;} public Instant getExpiresAt(){return expiresAt;} public Instant getFinishedAt(){return finishedAt;} public String getOutcome(){return outcome;}
}
