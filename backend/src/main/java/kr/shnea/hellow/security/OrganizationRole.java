package kr.shnea.hellow.security;

import jakarta.persistence.*;
import java.util.*;

@Entity @Table(name="organization_roles", uniqueConstraints=@UniqueConstraint(columnNames={"organizationId","name"}))
public class OrganizationRole {
  @Id private String id;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(nullable=false,length=100) private String name;
  private boolean active;
  @Version private Long version;
  @ElementCollection(fetch=FetchType.EAGER)
  @CollectionTable(name="role_grants",joinColumns=@JoinColumn(name="role_id"))
  @MapKeyColumn(name="permission",length=100)
  @Column(name="data_scope",nullable=false,length=32) @Enumerated(EnumType.STRING)
  private Map<String,DataScope> grants=new HashMap<>();
  protected OrganizationRole() {}
  public OrganizationRole(String id,String org,String name,Map<String,DataScope> grants) {this.id=id;organizationId=org;update(name,grants,true);}
  public void update(String name,Map<String,DataScope> grants,boolean active){this.name=name;this.grants=new HashMap<>(grants);this.active=active;}
  public String getId(){return id;} public String getOrganizationId(){return organizationId;}
  public String getName(){return name;} public boolean isActive(){return active;}
  public Long getVersion(){return version;} public Map<String,DataScope> getGrants(){return grants;}
}
