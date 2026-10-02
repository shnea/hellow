package kr.shnea.hellow.customer;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "customers")
public class Customer extends kr.shnea.hellow.security.OrganizationOwned {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(unique = true, nullable = false, length = 64)
  private String code;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private CustomerType customerType;

  @Column(nullable = false)
  private boolean registered;

  @Column(length = 100)
  private String name;

  @Column(length = 150)
  private String company;

  @Column(length = 100)
  private String department;

  @Column(length = 100)
  private String title;

  @Column(length = 32)
  private String tier;

  @Column(length = 50, nullable = false)
  private String phoneNumber;

  @Column(length = 150)
  private String email;

  @Column(length = 100)
  private String managerName;

  @Column(columnDefinition = "TEXT")
  private String customerNotes;

  @Column(nullable = false)
  private boolean complainant;

  private int totalCalls;

  private LocalDateTime lastContactAt;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public enum CustomerType {
    CORPORATE,
    INDIVIDUAL
  }

  protected Customer() {}

  public Customer(
      String code,
      CustomerType customerType,
      boolean registered,
      String name,
      String company,
      String department,
      String title,
      String tier,
      String phoneNumber,
      String email,
      String managerName,
      String customerNotes,
      boolean complainant) {
    this.code = code;
    this.customerType = customerType;
    this.registered = registered;
    this.name = name;
    this.company = company;
    this.department = department;
    this.title = title;
    this.tier = tier != null ? tier : "Standard";
    this.phoneNumber = phoneNumber;
    this.email = email;
    this.managerName = managerName;
    this.customerNotes = customerNotes;
    this.complainant = complainant;
    this.totalCalls = 1;
    this.createdAt = LocalDateTime.now();
    this.updatedAt = LocalDateTime.now();
  }

  @PreUpdate
  public void onUpdate() {
    this.updatedAt = LocalDateTime.now();
  }

  public void updateInfo(
      CustomerType type,
      String name,
      String company,
      String department,
      String title,
      String tier,
      String email,
      String notes,
      boolean complainant) {
    this.customerType = type;
    this.name = name;
    this.company = company;
    this.department = department;
    this.title = title;
    if (tier != null) this.tier = tier;
    this.email = email;
    this.customerNotes = notes;
    this.complainant = complainant;
    this.registered = true;
  }

  public void recordCall() {
    this.totalCalls++;
    this.lastContactAt = LocalDateTime.now();
  }

  // Getters
  public Long getId() {
    return id;
  }

  public String getCode() {
    return code;
  }

  public CustomerType getCustomerType() {
    return customerType;
  }

  public boolean isRegistered() {
    return registered;
  }

  public String getName() {
    return name;
  }

  public String getCompany() {
    return company;
  }

  public String getDepartment() {
    return department;
  }

  public String getTitle() {
    return title;
  }

  public String getTier() {
    return tier;
  }

  public String getPhoneNumber() {
    return phoneNumber;
  }

  public String getEmail() {
    return email;
  }

  public String getManagerName() {
    return managerName;
  }

  public String getCustomerNotes() {
    return customerNotes;
  }

  public boolean isComplainant() {
    return complainant;
  }

  public int getTotalCalls() {
    return totalCalls;
  }

  public LocalDateTime getLastContactAt() {
    return lastContactAt;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }
}
