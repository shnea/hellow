package kr.shnea.hellow.routing;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
public interface RoutingLockRepository extends JpaRepository<RoutingLock,Integer> {
  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select l from RoutingLock l where l.id=1")
  Optional<RoutingLock> acquire();
}
