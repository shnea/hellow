package kr.shnea.hellow.security;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, String> {
  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query("select o from Organization o where o.id=:id")
  Optional<Organization> lockById(String id);
  Optional<Organization> findByPublicCodeAndActiveTrue(String code);

  @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @org.springframework.data.jpa.repository.Query(
      "select o from Organization o where o.publicCode=:code and o.active=true")
  Optional<Organization> lockPublicCode(String code);
}
