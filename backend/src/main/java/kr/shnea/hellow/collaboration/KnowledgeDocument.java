package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.security.OrganizationOwned;

@Entity
@Table(name = "knowledge_documents")
public class KnowledgeDocument extends OrganizationOwned {
  @Id String id;
  @Version long version;

  @Column(nullable = false, length = 200)
  String title;

  @Column(nullable = false, length = 100)
  String category;

  @Column(nullable = false, length = 16)
  String kind, visibility, state;
  @Column(nullable = false, columnDefinition = "text")
  String document, bodyText, attachmentIds;

  @Column(nullable = false)
  long draftRevision;

  Long publishedRevision;

  @Column(length = 200)
  String publishedTitle;

  @Column(length = 100)
  String publishedCategory;

  @Column(columnDefinition = "text")
  String publishedBodyText;

  @Column(length = 16)
  String publishedVisibility, publishedKind;

  @Column(nullable = false, length = 255)
  String authorName;

  @Column(nullable = false)
  Instant createdAt, updatedAt;

  protected KnowledgeDocument() {}
}
