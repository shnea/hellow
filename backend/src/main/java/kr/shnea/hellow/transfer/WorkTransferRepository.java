package kr.shnea.hellow.transfer;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface WorkTransferRepository extends JpaRepository<WorkTransfer,String>,JpaSpecificationExecutor<WorkTransfer> {
  @Query("select t from WorkTransfer t where t.organizationId=:org and ((t.status=kr.shnea.hellow.transfer.WorkTransfer$Status.ACCEPTED and ((t.fromIssuer=:issuer and t.fromSubject=:subject) or (t.toIssuer=:issuer and t.toSubject=:subject))) or (t.status in (kr.shnea.hellow.transfer.WorkTransfer$Status.OFFERED,kr.shnea.hellow.transfer.WorkTransfer$Status.CONNECTING) and t.toIssuer=:issuer and t.toSubject=:subject))")
  List<WorkTransfer> readableParticipation(String org,String issuer,String subject);
  Optional<WorkTransfer> findByRequestKey(String key);
  List<WorkTransfer> findByOrganizationIdAndStatus(String org,WorkTransfer.Status status);
  boolean existsByOrganizationIdAndConsultationIdAndStatus(String org,Long id,WorkTransfer.Status status);
  List<WorkTransfer> findByStatus(WorkTransfer.Status status);
  List<WorkTransfer> findByStatusIn(java.util.Collection<WorkTransfer.Status> states);
  List<WorkTransfer> findByOrganizationIdAndStatusIn(String org,java.util.Collection<WorkTransfer.Status> states);
  boolean existsByOrganizationIdAndConsultationIdAndStatusIn(String org,Long recordId,java.util.Collection<WorkTransfer.Status> states);
  @Query("select t from WorkTransfer t where t.kind=kr.shnea.hellow.transfer.WorkTransfer$Kind.CALL and t.mediaCleanupUntil is not null and t.mediaCleanupComplete=false")
  List<WorkTransfer> callCleanupPending();
  List<WorkTransfer> findByOrganizationIdAndQueueCodeAndStatus(String org,String code,WorkTransfer.Status status);
  // Match the partial unique index exactly. Only a persisted terminal outcome releases its reservation.
  @Query("select t from WorkTransfer t where t.toIssuer=:issuer and t.toSubject=:subject and t.status in (kr.shnea.hellow.transfer.WorkTransfer$Status.OFFERED,kr.shnea.hellow.transfer.WorkTransfer$Status.CONNECTING) and t.liveWork=true")
  List<WorkTransfer> reservations(String issuer,String subject);
}
