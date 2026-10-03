package kr.shnea.hellow.followup;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FollowUpEventRepository extends JpaRepository<FollowUpEvent,Long> {
  List<FollowUpEvent> findByOrganizationIdAndFollowUpIdOrderByIdDesc(String organizationId,Long followUpId,Pageable page);
}
