package kr.shnea.hellow.security;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface OrganizationRoleRepository extends JpaRepository<OrganizationRole,String> {
  List<OrganizationRole> findByOrganizationIdOrderByName(String org);
  Optional<OrganizationRole> findByOrganizationIdAndId(String org,String id);
}
