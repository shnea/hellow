package kr.shnea.hellow.security;

import jakarta.persistence.*;
import java.util.Set;

@Entity
@Table(
    name = "memberships",
    uniqueConstraints = @UniqueConstraint(columnNames = {"organizationId", "issuer", "subject"}))
public class Membership {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String organizationId;

  @Column(nullable = false)
  private String subject;

  @Column(nullable = false)
  private String issuer;

  @Column(nullable = false)
  private boolean active;

  @Column(nullable = false)
  private String dataScope;
  @Column(nullable=false) private boolean deleted;
  public boolean isDeleted(){return deleted;}
  public void delete(){active=false;deleted=true;}

  @Version private Long version;
  @Column(length = 100) private String displayName;
  @Column(length = 255) private String loginId;
  @Column(length = 255) private String identityName;
  @Column(length = 64) private String teamId;
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name="membership_roles", joinColumns=@JoinColumn(name="membership_id"))
  @Column(name="role_id",length=64)
  private Set<String> roleIds = new java.util.HashSet<>();

  @ElementCollection(fetch = FetchType.EAGER)
  private Set<String> permissions;

  protected Membership() {}

  public Membership(String organizationId, String issuer, String subject, Set<String> permissions) {
    this.issuer = issuer;
    this.organizationId = organizationId;
    this.subject = subject;
    this.permissions = permissions;
    this.active = true;
    this.dataScope = "ORGANIZATION";
  }

  public Long getId() {
    return id;
  }

  public String getOrganizationId() {
    return organizationId;
  }

  public String getSubject() {
    return subject;
  }

  public void bindIdentity(String subject) { if(!this.subject.equals(subject))this.loginId=this.subject;this.subject=subject; }
  public String getLoginId(){return loginId;}
  public void profile(String login,String name){if(login!=null&&!login.isBlank()&&login.length()<=255&&!login.equals(subject))loginId=login;if(name!=null&&!name.isBlank()&&name.length()<=255)identityName=name;}

  public String getIssuer() {
    return issuer;
  }

  public void revoke() {
    this.active = false;
  }

  public boolean isActive() {
    return active;
  }

  public Set<String> getPermissions() {
    return permissions;
  }

  public String getDataScope() {
    return dataScope;
  }

  public Long getVersion() { return version; }
  public String getDisplayName() { return StaffNames.label(displayName,identityName,loginId,subject); }
  public String getTeamId() { return teamId; }
  public Set<String> getRoleIds() { return roleIds; }
  public void assignAccess(String teamId, Set<String> roles, DataScope directScope) {
    this.teamId=teamId;this.roleIds=new java.util.HashSet<>(roles);this.dataScope=directScope.name();
  }
  public void update(String displayName, Set<String> permissions, boolean active) {
    this.displayName = displayName; this.permissions = new java.util.HashSet<>(permissions); this.active = active;
  }
}
