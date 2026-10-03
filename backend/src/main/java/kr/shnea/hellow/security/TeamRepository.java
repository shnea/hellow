package kr.shnea.hellow.security;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TeamRepository extends JpaRepository<Team,String> {
  List<Team> findByOrganizationIdOrderByName(String org);
  Optional<Team> findByOrganizationIdAndId(String org,String id);
}
