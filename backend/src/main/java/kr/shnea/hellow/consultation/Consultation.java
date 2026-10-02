package kr.shnea.hellow.consultation;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "consultations")
public class Consultation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String customerCode;

    @Column(nullable = false, length = 100)
    private String categoryMain;

    @Column(nullable = false, length = 100)
    private String categorySub;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ConsultationStatus status;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(length = 255)
    private String tags;

    @Column(length = 100)
    private String agentName;

    private int callDurationSeconds;

    private LocalDateTime createdAt;

    public enum ConsultationStatus {
        IN_PROGRESS, COMPLETED, ESCALATED
    }

    protected Consultation() {}

    public Consultation(String customerCode, String categoryMain, String categorySub,
                        ConsultationStatus status, String memo, String tags,
                        String agentName, int callDurationSeconds) {
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

    public Long getId() { return id; }
    public String getCustomerCode() { return customerCode; }
    public String getCategoryMain() { return categoryMain; }
    public String getCategorySub() { return categorySub; }
    public ConsultationStatus getStatus() { return status; }
    public String getMemo() { return memo; }
    public String getTags() { return tags; }
    public String getAgentName() { return agentName; }
    public int getCallDurationSeconds() { return callDurationSeconds; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
