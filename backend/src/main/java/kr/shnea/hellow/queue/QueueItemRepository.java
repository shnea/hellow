package kr.shnea.hellow.queue;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface QueueItemRepository extends JpaRepository<QueueItem, Long> {
    Optional<QueueItem> findByCode(String code);
    Optional<QueueItem> findBySessionId(String sessionId);
    List<QueueItem> findByStatusOrderByCreatedAtDesc(QueueItem.QueueStatus status);
    List<QueueItem> findByStatusInOrderByCreatedAtDesc(List<QueueItem.QueueStatus> statuses);
    long countByStatus(QueueItem.QueueStatus status);
}
