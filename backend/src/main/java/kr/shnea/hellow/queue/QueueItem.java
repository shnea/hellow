package kr.shnea.hellow.queue;

import jakarta.persistence.*;
import kr.shnea.hellow.customer.Customer;
import java.time.LocalDateTime;

@Entity
@Table(name = "queue_items")
public class QueueItem {

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

    public enum ItemType {
        CALL, CALLBACK, TICKET
    }

    public enum QueueStatus {
        WAITING, PROCESSING, COMPLETED, CANCELLED
    }

    protected QueueItem() {}

    public QueueItem(String code, ItemType type, Customer.CustomerType customerType,
                     String customerName, String companyName, String phoneNumber,
                     String waitTimeOrSchedule, String priority, String summary,
                     boolean unread, boolean registered, boolean complainant) {
        this.code = code;
        this.type = type;
        this.customerType = customerType;
        this.customerName = customerName;
        this.companyName = companyName;
        this.phoneNumber = phoneNumber;
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

    public void updateCustomerDetails(String name, String company, Customer.CustomerType type, boolean complainant) {
        this.customerName = name;
        this.companyName = company;
        this.customerType = type;
        this.registered = true;
        this.complainant = complainant;
    }

    // Getters
    public Long getId() { return id; }
    public String getCode() { return code; }
    public ItemType getType() { return type; }
    public Customer.CustomerType getCustomerType() { return customerType; }
    public String getCustomerName() { return customerName; }
    public String getCompanyName() { return companyName; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getWaitTimeOrSchedule() { return waitTimeOrSchedule; }
    public String getPriority() { return priority; }
    public String getSummary() { return summary; }
    public boolean isUnread() { return unread; }
    public boolean isRegistered() { return registered; }
    public boolean isComplainant() { return complainant; }
    public QueueStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getAssignedAgent() { return assignedAgent; }
    public String getInquiryType() { return inquiryType; }
    public String getSessionId() { return sessionId; }
}
