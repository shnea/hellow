package kr.shnea.hellow.consultation;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "consultations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"organizationId", "queueCode"}))
public class Consultation extends kr.shnea.hellow.security.OrganizationOwned {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 64)
  private String customerCode;

  @Column(nullable = false, length = 100)
  private String categoryMain;

  @Column(nullable = false, length = 100)
  private String categorySub;

  @Column(length=64) private String categoryId;
  @Column(columnDefinition="TEXT") private String categoryPath;
  @Column(length=64) private String resultId;
  @Column(length=100) private String resultName;

  public String getCategoryId(){return categoryId;}
  public String getCategoryPath(){return categoryPath;}
  public String getResultId(){return resultId;}
  public String getResultName(){return resultName;}
  public void classify(kr.shnea.hellow.content.CatalogService.Selection s){
    categoryId=s.categoryId();categoryPath=s.categoryPath();categoryMain=s.main();categorySub=s.sub();resultId=s.resultId();resultName=s.resultName();
  }

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ConsultationStatus status;

  @Column(columnDefinition = "TEXT")
  private String memo;

  @Column(length = 255)
  private String tags;

  @Column(length = 100)
  private String agentName;
  @Column(length=255) private String currentAssigneeName;
  public String getCurrentAssigneeName(){return currentAssigneeName;}
  public void handoff(kr.shnea.hellow.security.WorkspaceAccess.Actor actor){assignOwner(actor);currentAssigneeName=actor.name();}

  private int callDurationSeconds;

  private LocalDateTime createdAt;

  public enum ConsultationStatus {
    IN_PROGRESS,
    COMPLETED,
    ESCALATED
  }

  @Column(length = 64)
  private String queueCode;

  private String agentSubject;

  @Column(columnDefinition = "TEXT")
  private String editorDocument;

  @Version private Long version;

  @Column(unique = true, length = 64) private String requestKey;
  public void setRequestKey(String key) { this.requestKey = key; }

  public String getQueueCode() {
    return queueCode;
  }

  public String getAgentSubject() {
    return agentSubject;
  }

  public String getEditorDocument() {
    return editorDocument;
  }

  public Long getVersion() {
    return version;
  }

  public void bind(String queueCode, String subject) {
    this.queueCode = queueCode;
    this.agentSubject = subject;
  }

  public void update(
      String customerCode,
      String main,
      String sub,
      ConsultationStatus status,
      String memo,
      String document,
      String tags,
      int duration) {
    this.customerCode = customerCode;
    this.categoryMain = main;
    this.categorySub = sub;
    this.status = status;
    this.memo = memo;
    this.editorDocument = document;
    this.tags = tags;
    this.callDurationSeconds = duration;
  }

  protected Consultation() {}

  public Consultation(
      String customerCode,
      String categoryMain,
      String categorySub,
      ConsultationStatus status,
      String memo,
      String tags,
      String agentName,
      int callDurationSeconds) {
    this.customerCode = customerCode;
    this.categoryMain = categoryMain;
    this.categorySub = categorySub;
    this.status = status;
    this.memo = memo;
    this.tags = tags;
    this.agentName = agentName;
    this.callDurationSeconds = callDurationSeconds;
    this.createdAt = LocalDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public String getCustomerCode() {
    return customerCode;
  }

  public void associateCustomer(String code){this.customerCode=code;}

  public String getCategoryMain() {
    return categoryMain;
  }

  public String getCategorySub() {
    return categorySub;
  }

  public ConsultationStatus getStatus() {
    return status;
  }

  public String getMemo() {
    return memo;
  }

  public String getTags() {
    return tags;
  }

  public String getAgentName() {
    return agentName;
  }

  public int getCallDurationSeconds() {
    return callDurationSeconds;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }
}
