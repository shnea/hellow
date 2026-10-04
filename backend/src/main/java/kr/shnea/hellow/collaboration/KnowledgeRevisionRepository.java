package kr.shnea.hellow.collaboration;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeRevisionRepository extends JpaRepository<KnowledgeRevision, Long> {
  Optional<KnowledgeRevision> findByDocumentIdAndRevision(String documentId, long revision);

  org.springframework.data.domain.Slice<KnowledgeRevision> findByDocumentIdOrderByRevisionDesc(
      String documentId, org.springframework.data.domain.Pageable page);
}
