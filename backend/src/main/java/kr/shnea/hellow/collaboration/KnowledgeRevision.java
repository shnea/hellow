package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "knowledge_revisions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"documentId", "revision"}))
public class KnowledgeRevision {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @Column(nullable = false, length = 64)
  String documentId;

  @Column(nullable = false)
  long revision;

  @Column(nullable = false, length = 200)
  String title;

  @Column(nullable = false, length = 100)
  String category;

  @Column(nullable = false, length = 16)
  String kind, visibility;
  @Column(nullable = false, columnDefinition = "text")
  String document, attachmentIds;
  @Column(nullable = false, length = 255)
  String editorIssuer, editorSubject, editorName;

  @Column(nullable = false)
  Instant createdAt;

  protected KnowledgeRevision() {}
}
