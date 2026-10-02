package kr.shnea.hellow.timeline;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimelineRepository extends JpaRepository<TimelineItem, Long> {
  List<TimelineItem> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);

  List<TimelineItem> findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(
      String organizationId, String customerCode);

  List<TimelineItem> findByOrganizationIdAndQueueCodeOrderByCreatedAtDesc(
      String organizationId, String queueCode);
}
