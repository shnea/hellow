package kr.shnea.hellow.security;

import jakarta.persistence.*;

@Entity @Table(name="teams", uniqueConstraints=@UniqueConstraint(columnNames={"organizationId","name"}))
public class Team {
  @Id private String id;
  @Column(nullable=false, length=64) private String organizationId;
  @Column(nullable=false, length=100) private String name;
  @Column(length=64) private String parentId;
  private boolean active;
  @Version private Long version;
  protected Team() {}
  public Team(String id,String org,String name,String parentId) { this.id=id;organizationId=org;this.name=name;this.parentId=parentId;active=true; }
  public void update(String name,String parentId,boolean active) {this.name=name;this.parentId=parentId;this.active=active;}
  public String getId(){return id;} public String getOrganizationId(){return organizationId;}
  public String getName(){return name;} public String getParentId(){return parentId;}
  public boolean isActive(){return active;} public Long getVersion(){return version;}
}
