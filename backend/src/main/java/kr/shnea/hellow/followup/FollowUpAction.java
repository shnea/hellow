package kr.shnea.hellow.followup;

import jakarta.persistence.*;
import java.time.LocalDateTime;

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
  private String status; // PENDING, COMPLETED

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
}
