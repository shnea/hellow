package kr.shnea.hellow.consultation;

import jakarta.persistence.*;
import java.time.Instant;

/** Preserves the complete record before an employee changes historical content. */
@Entity
@Table(name = "consultation_revisions")
public class ConsultationRevision extends kr.shnea.hellow.security.OrganizationOwned {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  private Long consultationId;
  private String actorSubject;
  private String actorName;
  private Instant changedAt;
  @Column(columnDefinition="TEXT") private String beforeDocument;
  protected ConsultationRevision() {}
  public ConsultationRevision(Consultation record, String subject, String name, String snapshot) {
    setOrganizationId(record.getOrganizationId()); consultationId=record.getId(); actorSubject=subject;
    actorName=name; beforeDocument=snapshot; changedAt=Instant.now();
  }
  public Long getId(){return id;}
  public Long getConsultationId(){return consultationId;}
  public String getActorSubject(){return actorSubject;}
  public String getActorName(){return actorName;}
  public Instant getChangedAt(){return changedAt;}
  public String getBeforeDocument(){return beforeDocument;}
}
