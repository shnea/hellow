package kr.shnea.hellow.content;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ConsultationCatalogRepository extends JpaRepository<ConsultationCatalog,String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from ConsultationCatalog c where c.ownerId=:id")
  Optional<ConsultationCatalog> lockByOwnerId(@Param("id") String id);
}
