package kr.shnea.hellow.platform;

import jakarta.persistence.*;
import kr.shnea.hellow.security.OrganizationOwned;

@Entity
@Table(
    name = "attachments",
    uniqueConstraints =
        @UniqueConstraint(columnNames = {"organizationId", "queueCode", "requestId"}))
public class Attachment extends OrganizationOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String queueCode;

  @Column(nullable = false, unique = true)
  private String fileId;

  @Column(nullable = false)
  private String requestId;

  private String name;
  private String kind;
  private long size;
  private String sha256;

  protected Attachment() {}

  public Attachment(
      String organizationId,
      String queueCode,
      String fileId,
      String requestId,
      String name,
      String kind,
      long size,
      String sha256) {
    setOrganizationId(organizationId);
    this.queueCode = queueCode;
    this.fileId = fileId;
    this.requestId = requestId;
    this.name = name;
    this.kind = kind;
    this.size = size;
    this.sha256 = sha256;
  }

  public String getQueueCode() {
    return queueCode;
  }

  public String getFileId() {
    return fileId;
  }

  public String getName() {
    return name;
  }

  public String getKind() {
    return kind;
  }

  public long getSize() {
    return size;
  }

  public String getSha256() {
    return sha256;
  }
}
