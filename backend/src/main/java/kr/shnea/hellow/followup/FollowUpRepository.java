package kr.shnea.hellow.followup;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FollowUpRepository extends JpaRepository<FollowUpAction, Long> {
  List<FollowUpAction> findByOrganizationIdAndQueueCode(String organizationId,String queueCode);
  List<FollowUpAction> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);

  List<FollowUpAction> findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(
      String organizationId, String customerCode);
}
