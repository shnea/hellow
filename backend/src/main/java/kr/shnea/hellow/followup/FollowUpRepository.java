package kr.shnea.hellow.followup;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.*;
import java.time.Instant;
import java.util.Optional;

public interface FollowUpRepository extends JpaRepository<FollowUpAction, Long>,JpaSpecificationExecutor<FollowUpAction> {
  Optional<FollowUpAction> findByRequestKey(String key);
  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select f from FollowUpAction f where f.organizationId=:org and f.id=:id")
  Optional<FollowUpAction> lockById(String org,Long id);
  @Query("select f from FollowUpAction f where f.ownerIssuer=:issuer and f.ownerSubject=:subject and f.status='IN_PROGRESS' order by f.id")
  List<FollowUpAction> activeForIdentity(String issuer,String subject);
  @Query("select count(f) from FollowUpAction f where f.ownerIssuer=:issuer and f.ownerSubject=:subject and f.id<>:id and f.status in ('SCHEDULED','IN_PROGRESS') and f.scheduledAt<:end and f.scheduledEndAt>:start")
  long overlaps(String issuer,String subject,Long id,Instant start,Instant end);
  List<FollowUpAction> findByOrganizationIdAndQueueCode(String organizationId,String queueCode);
  List<FollowUpAction> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);

  List<FollowUpAction> findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(
      String organizationId, String customerCode);
}
