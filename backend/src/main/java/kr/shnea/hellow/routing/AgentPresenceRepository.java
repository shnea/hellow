package kr.shnea.hellow.routing;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AgentPresenceRepository extends JpaRepository<AgentPresence,String> {
  Optional<AgentPresence> findByIssuerAndSubject(String issuer,String subject);
  List<AgentPresence> findByOrganizationId(String organizationId);
}
