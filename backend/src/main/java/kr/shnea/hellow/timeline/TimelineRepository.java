package kr.shnea.hellow.timeline;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TimelineRepository extends JpaRepository<TimelineItem, Long> {
    List<TimelineItem> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);
}
