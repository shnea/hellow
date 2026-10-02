package kr.shnea.hellow.queue;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QueueItemRepository extends JpaRepository<QueueItem, Long> {
  Optional<QueueItem> findByCode(String code);

  Optional<QueueItem> findByOrganizationIdAndCode(String organizationId, String code);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "select q from QueueItem q where q.organizationId=:organizationId and q.code=:code")
  Optional<QueueItem> lockByCode(String organizationId, String code);

  List<QueueItem> findByOrganizationIdAndStatusInOrderByCreatedAtDesc(
      String organizationId, List<QueueItem.QueueStatus> statuses);

  boolean existsByOrganizationIdAndAssignedSubjectAndStatusAndCallEndedFalseAndType(
      String organizationId, String subject, QueueItem.QueueStatus status, QueueItem.ItemType type);

  long countByOrganizationIdAndStatus(String organizationId, QueueItem.QueueStatus status);

  Optional<QueueItem> findBySessionId(String sessionId);

  Optional<QueueItem> findByRequestKey(String key);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "select q from QueueItem q where q.sessionId=:sessionId")
  Optional<QueueItem> lockSession(String sessionId);

  List<QueueItem> findByCallEndedTrueAndMediaCleanupUntilAfter(java.time.Instant now);

  List<QueueItem> findByStatusAndCallEndedFalse(QueueItem.QueueStatus status);

  List<QueueItem> findByStatusOrderByCreatedAtDesc(QueueItem.QueueStatus status);

  List<QueueItem> findByStatusInOrderByCreatedAtDesc(List<QueueItem.QueueStatus> statuses);

  long countByStatus(QueueItem.QueueStatus status);
}
