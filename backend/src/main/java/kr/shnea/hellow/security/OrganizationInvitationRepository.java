package kr.shnea.hellow.security;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface OrganizationInvitationRepository extends JpaRepository<OrganizationInvitation, String> {
  List<OrganizationInvitation> findByOrganizationIdOrderByExpiresAtDesc(String organizationId);
  Optional<OrganizationInvitation> findByTokenHash(String tokenHash);
}
