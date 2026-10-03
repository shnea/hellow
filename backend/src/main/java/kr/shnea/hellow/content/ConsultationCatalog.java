package kr.shnea.hellow.content;

import jakarta.persistence.*;

/** One versioned catalog per owner. Organization overrides replace the whole inherited catalog. */
@Entity @Table(name="consultation_catalogs")
public class ConsultationCatalog {
  @Id @Column(length=64) private String ownerId;
  @Column(nullable=false) private boolean overridden;
  @Column(columnDefinition="TEXT",nullable=false) private String document;
  @Version private Long version;
  protected ConsultationCatalog() {}
  public ConsultationCatalog(String ownerId,String document){this.ownerId=ownerId;this.document=document;}
  public void update(boolean overridden,String document){this.overridden=overridden;this.document=document;}
  public String getOwnerId(){return ownerId;}
  public boolean isOverridden(){return overridden;}
  public String getDocument(){return document;}
  public Long getVersion(){return version;}
}
