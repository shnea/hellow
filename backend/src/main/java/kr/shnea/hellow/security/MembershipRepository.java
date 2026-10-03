package kr.shnea.hellow.security;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface MembershipRepository extends JpaRepository<Membership, Long> {
  List<Membership> findByOrganizationIdOrderById(String organizationId);
  Optional<Membership> findByOrganizationIdAndIssuerAndSubject(String organizationId, String issuer, String subject);
  Optional<Membership> findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
      String organizationId, String issuer, String subject);

  List<Membership> findByIssuerAndSubjectAndActiveTrue(String issuer, String subject);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select m from Membership m where m.organizationId=:organizationId and m.issuer=:issuer and"
          + " m.subject=:subject and m.active=true")
  Optional<Membership> lockActive(String organizationId, String issuer, String subject);
}
