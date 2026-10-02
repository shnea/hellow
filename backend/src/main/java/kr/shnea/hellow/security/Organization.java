package kr.shnea.hellow.security;

import jakarta.persistence.*;

@Entity
@Table(name = "organizations")
public class Organization {
  @Id
  @Column(length = 64)
  private String id;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false)
  private boolean active;

  @Column(unique = true)
  private String publicCode;

  protected Organization() {}

  public Organization(String id, String name, String publicCode) {
    this.id = id;
    this.name = name;
    this.publicCode = publicCode;
    this.active = true;
  }

  public String getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public boolean isActive() {
    return active;
  }

  public String getPublicCode() {
    return publicCode;
  }
}
