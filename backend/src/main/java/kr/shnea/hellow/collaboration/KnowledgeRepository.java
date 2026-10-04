package kr.shnea.hellow.collaboration;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface KnowledgeRepository
    extends JpaRepository<KnowledgeDocument, String>, JpaSpecificationExecutor<KnowledgeDocument> {
  Optional<KnowledgeDocument> findByOrganizationIdAndId(String org, String id);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from KnowledgeDocument d where d.organizationId=:org and d.id=:id")
  Optional<KnowledgeDocument> lock(String org, String id);
}
