package kr.shnea.hellow.content;
import jakarta.persistence.*;

/** Markdown is copied into a consultation document. It carries no file access authority. */
@Entity @Table(name="text_templates",uniqueConstraints=@UniqueConstraint(columnNames={"organizationId","originId"}))
public class TextTemplate {
  public enum Scope {COMMON,ORGANIZATION,PERSONAL}
  @Id @Column(length=64) private String id;
  @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private Scope scope;
  @Column(nullable=false,length=64) private String organizationId;
  @Column(length=64) private String originId;
  @Column(length=255) private String ownerIssuer;
  @Column(length=255) private String ownerSubject;
  @Column(nullable=false,length=150) private String name;
  @Column(columnDefinition="TEXT",nullable=false) private String body;
  @Column(nullable=false) private boolean active=true;
  @Column(nullable=false) private boolean inherited;
  @Version private Long version;
  protected TextTemplate(){}
  public TextTemplate(String id,Scope scope,String org,String origin,String issuer,String subject){this.id=id;this.scope=scope;organizationId=org;originId=origin;ownerIssuer=issuer;ownerSubject=subject;}
  public void update(String name,String body,boolean active){this.name=name;this.body=body;this.active=active;this.inherited=false;}
  public void restore(){inherited=true;}
  public String getId(){return id;}public Scope getScope(){return scope;}public String getOrganizationId(){return organizationId;}
  public String getOriginId(){return originId;}public String getOwnerIssuer(){return ownerIssuer;}public String getOwnerSubject(){return ownerSubject;}
  public String getName(){return name;}public String getBody(){return body;}public boolean isActive(){return active;}
  public boolean isInherited(){return inherited;}public Long getVersion(){return version;}
}
