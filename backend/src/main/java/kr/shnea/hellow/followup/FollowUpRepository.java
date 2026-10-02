package kr.shnea.hellow.followup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FollowUpRepository extends JpaRepository<FollowUpAction, Long> {
    List<FollowUpAction> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);
}
