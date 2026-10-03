package kr.shnea.hellow.routing;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface AssignmentAttemptRepository extends JpaRepository<AssignmentAttempt,String> {
  @Query("select a from AssignmentAttempt a where a.outcome in (kr.shnea.hellow.routing.AssignmentAttempt$Outcome.OFFERED,kr.shnea.hellow.routing.AssignmentAttempt$Outcome.RINGING) and a.organizationId=:org order by a.queueCode")
  List<AssignmentAttempt> activeInOrganization(String org);
  @Query("select a from AssignmentAttempt a where a.outcome in (kr.shnea.hellow.routing.AssignmentAttempt$Outcome.OFFERED,kr.shnea.hellow.routing.AssignmentAttempt$Outcome.RINGING) and a.presenceId=:id")
  Optional<AssignmentAttempt> activeForPresence(String id);
  @Query("select a from AssignmentAttempt a where a.outcome in (kr.shnea.hellow.routing.AssignmentAttempt$Outcome.OFFERED,kr.shnea.hellow.routing.AssignmentAttempt$Outcome.RINGING) and a.organizationId=:org and a.queueCode=:code")
  Optional<AssignmentAttempt> activeForQueue(String org,String code);
  List<AssignmentAttempt> findByOrganizationIdAndQueueCodeAndRoutingCycle(String org,String code,int cycle);
  List<AssignmentAttempt> findTop100ByOrganizationIdAndQueueCodeOrderByOfferedAtDesc(String org,String code);
}
