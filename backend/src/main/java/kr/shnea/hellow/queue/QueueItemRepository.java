package kr.shnea.hellow.queue;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface QueueItemRepository extends JpaRepository<QueueItem, Long> {
    Optional<QueueItem> findByCode(String code);
    List<QueueItem> findByStatusOrderByCreatedAtDesc(QueueItem.QueueStatus status);
}
