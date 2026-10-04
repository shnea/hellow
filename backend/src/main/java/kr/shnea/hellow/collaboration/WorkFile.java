package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "work_files",
    uniqueConstraints =
        @UniqueConstraint(
            columnNames = {
              "organizationId",
              "ownerKind",
              "ownerId",
              "uploaderIssuer",
              "uploaderSubject",
              "requestId"
            }))
public class WorkFile {
  @Id String id;

  @Column(nullable = false, length = 64)
  String organizationId;

  @Column(nullable = false, length = 16)
  String ownerKind;

  @Column(nullable = false, length = 64)
  String ownerId;

  @Column(nullable = false, length = 255)
  String uploaderIssuer, uploaderSubject;

  @Column(nullable = false, length = 36)
  String requestId;

  @Column(nullable = false, length = 255)
  String platformFileId, name;

  @Column(nullable = false, length = 120)
  String mime;

  @Column(nullable = false)
  long size;

  @Column(nullable = false, length = 64)
  String sha256;

  @Column(nullable = false)
  Instant createdAt;

  Long messageSequence;

  protected WorkFile() {}
}
