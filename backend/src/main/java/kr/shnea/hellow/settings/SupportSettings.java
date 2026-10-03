package kr.shnea.hellow.settings;
import jakarta.persistence.*;
@Entity @Table(name = "support_settings")
public class SupportSettings {
  @Id private String ownerId;
  @Version private Long version;
  @Column(length = 150) private String title;
  @Column(length = 500) private String description;
  @Column(length = 100) private String buttonLabel;
  @Column(length = 7) private String primaryColor;
  @Column(length = 1000) private String logoUrl;
  protected SupportSettings() {}
  public SupportSettings(String ownerId) { this.ownerId = ownerId; }
  public String getOwnerId() { return ownerId; }
  public Long getVersion() { return version; }
  public String getTitle() { return title; }
  public String getDescription() { return description; }
  public String getButtonLabel() { return buttonLabel; }
  public String getPrimaryColor() { return primaryColor; }
  public String getLogoUrl() { return logoUrl; }
  public void update(String title, String description, String buttonLabel, String primaryColor, String logoUrl) {
    this.title = title; this.description = description; this.buttonLabel = buttonLabel;
    this.primaryColor = primaryColor; this.logoUrl = logoUrl;
  }
}
