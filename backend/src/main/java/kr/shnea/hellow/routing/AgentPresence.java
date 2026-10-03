package kr.shnea.hellow.routing;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One availability lease per platform identity, even when it belongs to multiple organizations. */
@Entity
@Table(name="agent_presence", uniqueConstraints=@UniqueConstraint(columnNames={"issuer","subject"}))
public class AgentPresence {
  public enum Availability { AVAILABLE, AWAY, OFFLINE }
  @Id @Column(length=64) private String id;
  @Column(nullable=false,length=255) private String issuer;
  @Column(nullable=false,length=255) private String subject;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false,length=100) private String displayName;
  @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private Availability availability;
  private Instant heartbeatAt;
  @Column(nullable=false) private Instant availableSince;
  @Column(length=64) private String workQueueCode;
  @Column(nullable=false) private long stateRevision;
  @Version private Long version;
  protected AgentPresence() {}
  AgentPresence(String issuer,String subject,String org,String name,Instant now) {
    id=UUID.nameUUIDFromBytes((issuer+"\n"+subject).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
    this.issuer=issuer;this.subject=subject;organizationId=org;displayName=name;
    availability=Availability.OFFLINE;availableSince=now;heartbeatAt=now;
  }
  public String getId(){return id;}
  public String getIssuer(){return issuer;}
  public String getSubject(){return subject;}
  public String getOrganizationId(){return organizationId;}
  public String getDisplayName(){return displayName;}
  public Availability getAvailability(){return availability;}
  public Instant getHeartbeatAt(){return heartbeatAt;}
  public Instant getAvailableSince(){return availableSince;}
  public long getStateRevision(){return stateRevision;}
  public boolean live(Instant now){return heartbeatAt!=null&&heartbeatAt.plusSeconds(45).isAfter(now);}
  void heartbeat(String name,Instant now){displayName=name;heartbeatAt=now;}
  void change(String org,Availability state,Instant now){organizationId=org;availability=state;availableSince=now;stateRevision++;heartbeatAt=now;}
  void missed(Instant now){availability=Availability.AWAY;availableSince=now;stateRevision++;}
  void released(Instant now){availableSince=now;}
  void observeWork(String code,Instant now){if(workQueueCode!=null&&code==null)availableSince=now;workQueueCode=code;}
}
