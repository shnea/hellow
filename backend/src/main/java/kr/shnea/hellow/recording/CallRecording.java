package kr.shnea.hellow.recording;

import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.security.OrganizationOwned;

/** One durable capture/upload job per call. File capabilities are never serialized from this entity. */
@Entity @Table(name="call_recordings",uniqueConstraints=@UniqueConstraint(name="call_recordings_organization_id_queue_code_key",columnNames={"organizationId","queueCode"}))
public class CallRecording extends OrganizationOwned {
  public enum State { PENDING, STARTING, RECORDING, UPLOADING, READY, FAILED, NO_AUDIO }
  @Id @Column(length=64) private String id;
  @Column(nullable=false,length=64) private String queueCode;
  @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private State state;
  @Column(length=128) private String egressId;
  @Column(length=255) private String fileId;
  @Column(nullable=false) private Instant createdAt,updatedAt,retryAt;
  private Instant leaseUntil;
  @Column(nullable=false) private int attempts;
  @Column(length=64) private String errorCode;
  @Column(nullable=false) private long durationSeconds;
  @Version private Long version;
  protected CallRecording(){}
  public CallRecording(QueueItem q){id=java.util.UUID.randomUUID().toString();setOrganizationId(q.getOrganizationId());copyOwner(q);queueCode=q.getCode();state=State.PENDING;createdAt=updatedAt=retryAt=Instant.now();}
  public String getId(){return id;} public String getQueueCode(){return queueCode;} public State getState(){return state;}
  public String getEgressId(){return egressId;} public String getFileId(){return fileId;} public Instant getCreatedAt(){return createdAt;}
  public Instant getUpdatedAt(){return updatedAt;} public int getAttempts(){return attempts;} public String getErrorCode(){return errorCode;}
  public long getDurationSeconds(){return durationSeconds;}
  Long revision(){return version;} void revision(Long value){version=value;}
  boolean leased(){return leaseUntil!=null&&leaseUntil.isAfter(Instant.now());}
  void transition(State value){state=value;updatedAt=Instant.now();errorCode=null;attempts=0;}
  void started(String id){egressId=id;transition(State.RECORDING);}
  void uploading(long seconds){durationSeconds=seconds;transition(State.UPLOADING);}
  void ready(String id){fileId=id;transition(State.READY);}
  void failure(String code){errorCode=code;attempts++;retryAt=Instant.now().plusSeconds(Math.min(300,5L<<Math.min(attempts,6)));}
  void release(){leaseUntil=null;}
  void retry(){if(state==State.FAILED&&egressId==null)transition(State.PENDING);retryAt=Instant.now();attempts=0;}
}
