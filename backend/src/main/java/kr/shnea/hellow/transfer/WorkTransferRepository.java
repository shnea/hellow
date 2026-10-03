package kr.shnea.hellow.transfer;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface WorkTransferRepository extends JpaRepository<WorkTransfer,String>,JpaSpecificationExecutor<WorkTransfer> {
  Optional<WorkTransfer> findByRequestKey(String key);
  List<WorkTransfer> findByOrganizationIdAndStatus(String org,WorkTransfer.Status status);
  boolean existsByOrganizationIdAndConsultationIdAndStatus(String org,Long id,WorkTransfer.Status status);
  List<WorkTransfer> findByStatus(WorkTransfer.Status status);
  List<WorkTransfer> findByOrganizationIdAndQueueCodeAndStatus(String org,String code,WorkTransfer.Status status);
  // Match the partial unique index exactly. Only a persisted terminal outcome releases its reservation.
  @Query("select t from WorkTransfer t where t.toIssuer=:issuer and t.toSubject=:subject and t.status=kr.shnea.hellow.transfer.WorkTransfer$Status.OFFERED and t.liveWork=true")
  List<WorkTransfer> reservations(String issuer,String subject);
}
