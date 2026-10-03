package kr.shnea.hellow.customer;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import kr.shnea.hellow.security.WorkspaceAccess;

/** The original interaction remains intact; this records a reversible association. */
@Entity @Table(name="customer_history_links")
public class CustomerHistoryLink {
  @Id @Column(length=64) private String id;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false,length=64) private String queueCode;
  @Column(nullable=false,length=64) private String customerCode;
  private boolean originalRegistered;
  @Column(nullable=false,length=255) private String actorIssuer;
  @Column(nullable=false,length=255) private String actorSubject;
  @Column(nullable=false,length=100) private String actorName;
  private Instant linkedAt;
  private Instant undoneAt;
  protected CustomerHistoryLink(){}
  public CustomerHistoryLink(WorkspaceAccess.Actor actor,String queue,String customer,boolean registered){
    id=UUID.randomUUID().toString();organizationId=actor.organizationId();queueCode=queue;customerCode=customer;
    originalRegistered=registered;actorIssuer=actor.issuer();actorSubject=actor.subject();actorName=actor.name();linkedAt=Instant.now();
  }
  public String getId(){return id;}
  public String getOrganizationId(){return organizationId;}
  public String getQueueCode(){return queueCode;}
  public String getCustomerCode(){return customerCode;}
  public boolean isOriginalRegistered(){return originalRegistered;}
  public String getActorName(){return actorName;}
  public Instant getLinkedAt(){return linkedAt;}
  public Instant getUndoneAt(){return undoneAt;}
  public void undo(){undoneAt=Instant.now();}
}
