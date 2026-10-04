package kr.shnea.hellow.queue;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import kr.shnea.hellow.customer.Customer;

@Entity
@Table(name = "queue_items")
public class QueueItem extends kr.shnea.hellow.security.OrganizationOwned {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(unique = true, nullable = false, length = 64)
  private String code;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private ItemType type;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private Customer.CustomerType customerType;

  @Column(nullable = false, length = 100)
  private String customerName;

  @Column(length = 150)
  private String companyName;

  @Column(nullable = false, length = 50)
  private String phoneNumber;

  @Column(length=50) private String phoneKey;
  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getPhoneKey(){return phoneKey;}

  /** Historical association keeps the original caller's submitted details. */
  public void associateCustomer(String code,boolean registered){this.customerCode=code;this.registered=registered;}

  @Column(length = 50)
  private String waitTimeOrSchedule;

  @Column(length = 32)
  private String priority; // urgent, normal, low

  @Column(columnDefinition = "TEXT")
  private String summary;

  private boolean unread;
  private boolean registered;
  private boolean complainant;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private QueueStatus status;

  private LocalDateTime createdAt;

  @Column(length = 100)
  private String assignedAgent;

  @Column(length = 100)
  private String inquiryType;

  @Column(length = 100)
  private String sessionId;

  @Column(unique = true)
  private String requestKey;

  @Column(nullable=false) private boolean chatEnabled;
  @Column(nullable=false) private long chatSequence;
  private java.time.Instant chatEndedAt;
  public boolean isChatEnabled(){return chatEnabled;}
  @com.fasterxml.jackson.annotation.JsonIgnore
  public long getChatSequence(){return chatSequence;}
  public java.time.Instant getChatEndedAt(){return chatEndedAt;}
  public void enableChat(){chatEnabled=true;}
  public long nextChatSequence(){return ++chatSequence;}
  public void endChat(java.time.Instant now){if(chatEnabled&&chatEndedAt==null)chatEndedAt=now;}

  private java.time.Instant supportExpiresAt;
  private java.time.Instant callbackDueAt;
  private Long callbackFollowUpId;
  public java.time.Instant getCallbackDueAt(){return callbackDueAt;}
  public Long getCallbackFollowUpId(){return callbackFollowUpId;}
  public void awaitCallbackUntil(java.time.Instant deadline){callbackDueAt=deadline;}
  public boolean callbackDue(java.time.Instant now){return type==ItemType.CALL&&status==QueueStatus.WAITING&&callbackDueAt!=null&&!now.isBefore(callbackDueAt);}
  public void convertedToCallback(Long id){callbackFollowUpId=id;cancel();}
  @Column(length=64) private String requestFingerprint;
  @com.fasterxml.jackson.annotation.JsonIgnore
  public java.time.Instant getSupportExpiresAt(){return supportExpiresAt;}
  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getRequestFingerprint(){return requestFingerprint;}
  public void initializeSupportSession(java.time.Instant expiresAt,String fingerprint){supportExpiresAt=expiresAt;requestFingerprint=fingerprint;}
  public boolean supportExpired(java.time.Instant now){return supportExpiresAt!=null&&!supportExpiresAt.isAfter(now);}

  public void setRequestKey(String key) {
    this.requestKey = key;
  }

  @Column(length = 64)
  private String customerCode;

  private String assignedSubject;
  private boolean callEnded;
  private java.time.Instant mediaRequestedAt;
  private java.time.Instant callStartedAt;
  private java.time.Instant firstAcceptedAt;
  public java.time.Instant getFirstAcceptedAt(){return firstAcceptedAt;}
  public void recordFirstAcceptance(java.time.Instant now){if(firstAcceptedAt==null)firstAcceptedAt=now;}
  private java.time.Instant callEndedAt;
  private java.time.Instant mediaMissingSince;
  public java.time.Instant getMediaMissingSince(){return mediaMissingSince;}
  public java.time.Instant getCallStartedAt(){return callStartedAt;}
  public java.time.Instant getCallEndedAt(){return callEndedAt;}
  public void requestMedia(java.time.Instant now){if(mediaRequestedAt==null)mediaRequestedAt=now;}
  /** Both actual media participants, rather than token issuance, start the shared clock. */
  public boolean observeMedia(java.time.Instant now,boolean bothConnected){
    if(callEnded)return false;
    if(bothConnected){
      boolean changed=callStartedAt==null||mediaMissingSince!=null;
      if(callStartedAt==null)callStartedAt=now;
      mediaMissingSince=null;return changed;
    }
    if(mediaRequestedAt==null)return false;
    if(callStartedAt==null){if(!now.isBefore(mediaRequestedAt.plusSeconds(60))){endCall(now);return true;}return false;}
    if(mediaMissingSince==null){mediaMissingSince=now;return true;}
    if(!now.isBefore(mediaMissingSince.plusSeconds(30))){endCall(now);return true;}
    return false;
  }
  private java.time.Instant mediaCleanupUntil;
  @Column(length=255) private String mediaAgentIdentity;
  public String getMediaAgentIdentity(){return mediaAgentIdentity==null?"agent-"+assignedSubject:mediaAgentIdentity;}
  public void useMediaIdentity(String identity){this.mediaAgentIdentity=identity;}
  @Version private Long version;
  @Column(nullable=false) private int routingCycle;
  public int getRoutingCycle(){return routingCycle;}
  public void restartRouting(){routingCycle++;}

  public String getCustomerCode() {
    return customerCode;
  }

  public void linkCustomer(Customer customer) {
    if (!java.util.Objects.equals(getOrganizationId(), customer.getOrganizationId()))
      throw new IllegalArgumentException("Organization mismatch");
    this.customerCode = customer.getCode();
    updateCustomerDetails(
        customer.getName(),
        customer.getCompany(),
        customer.getCustomerType(),
        customer.isComplainant());
  }

  public String getAssignedSubject() {
    return assignedSubject;
  }

  public boolean isCallEnded() {
    return callEnded;
  }

  public Long getVersion() {
    return version;
  }

  public void acceptBy(String subject, String name) {
    if (status != QueueStatus.WAITING)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.CONFLICT, "이미 처리 중이거나 종료된 요청입니다.");
    this.assignedSubject = subject;
    accept(name);
  }

  public java.time.Instant getMediaCleanupUntil() {
    return mediaCleanupUntil;
  }

  public void mediaCleanupSucceeded(java.time.Instant now) {
    if (callEnded && mediaCleanupUntil != null && !mediaCleanupUntil.isAfter(now))
      mediaCleanupUntil = null;
  }

  /** Called under the source queue lock after a work transfer's recipient is verified. */
  public void handoff(kr.shnea.hellow.security.WorkspaceAccess.Actor recipient) {
    if(status!=QueueStatus.PROCESSING)
      throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"진행 중 접수만 담당자를 변경할 수 있습니다.");
    assignedSubject=recipient.subject();assignedAgent=recipient.name();assignOwner(recipient);
  }

  public void endCall() {
    endCall(java.time.Instant.now());
  }
  public void endCall(java.time.Instant now) {
    if (!this.callEnded) {this.mediaCleanupUntil = now.plusSeconds(180);this.callEndedAt=now;}
    this.callEnded = true;
  }

  public void requireOwner(String subject) {
    if (status != QueueStatus.PROCESSING || !java.util.Objects.equals(assignedSubject, subject))
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.CONFLICT, "본인이 수락한 활성 상담만 처리할 수 있습니다.");
  }

  public enum ItemType {
    CALL,
    CALLBACK,
    TICKET
  }

  public enum QueueStatus {
    WAITING,
    PROCESSING,
    COMPLETED,
    CANCELLED
  }

  protected QueueItem() {}

  public QueueItem(
      String code,
      ItemType type,
      Customer.CustomerType customerType,
      String customerName,
      String companyName,
      String phoneNumber,
      String waitTimeOrSchedule,
      String priority,
      String summary,
      boolean unread,
      boolean registered,
      boolean complainant) {
    this.code = code;
    this.type = type;
    this.customerType = customerType;
    this.customerName = customerName;
    this.companyName = companyName;
    this.phoneNumber = phoneNumber;
    this.phoneKey = kr.shnea.hellow.customer.PhoneNumbers.key(phoneNumber);
    this.waitTimeOrSchedule = waitTimeOrSchedule;
    this.priority = priority;
    this.summary = summary;
    this.unread = unread;
    this.registered = registered;
    this.complainant = complainant;
    this.status = QueueStatus.WAITING;
    this.createdAt = LocalDateTime.now();
  }

  public void setSessionId(String sessionId) {
    this.sessionId = sessionId;
  }

  public void setInquiryType(String inquiryType) {
    this.inquiryType = inquiryType;
  }

  public void accept(String agentName) {
    this.status = QueueStatus.PROCESSING;
    this.assignedAgent = agentName;
    this.unread = false;
  }

  public void cancel() {
    this.status = QueueStatus.CANCELLED;
  }

  public void complete() {
    this.status = QueueStatus.COMPLETED;
  }

  public void updateCustomerDetails(
      String name, String company, Customer.CustomerType type, boolean complainant) {
    this.customerName = name;
    this.companyName = company;
    this.customerType = type;
    this.registered = true;
    this.complainant = complainant;
  }

  // Getters
  public void updateUnregisteredContact(String name,String company,String phone,Customer.CustomerType type){
    this.customerName=name;this.companyName=company;this.phoneNumber=phone;
    this.phoneKey=kr.shnea.hellow.customer.PhoneNumbers.key(phone);this.customerType=type;
  }
  public Long getId() {
    return id;
  }

  public String getCode() {
    return code;
  }

  public ItemType getType() {
    return type;
  }

  public Customer.CustomerType getCustomerType() {
    return customerType;
  }

  public String getCustomerName() {
    return customerName;
  }

  public String getCompanyName() {
    return companyName;
  }

  public String getPhoneNumber() {
    return phoneNumber;
  }

  public String getWaitTimeOrSchedule() {
    return waitTimeOrSchedule;
  }

  public String getPriority() {
    return priority;
  }

  public String getSummary() {
    return summary;
  }

  public boolean isUnread() {
    return unread;
  }

  public boolean isRegistered() {
    return registered;
  }

  public boolean isComplainant() {
    return complainant;
  }

  public QueueStatus getStatus() {
    return status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public String getAssignedAgent() {
    return assignedAgent;
  }

  public String getInquiryType() {
    return inquiryType;
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getSessionId() {
    return sessionId;
  }
}
