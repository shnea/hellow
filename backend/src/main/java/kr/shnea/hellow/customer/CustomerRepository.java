package kr.shnea.hellow.customer;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
  Optional<Customer> findByCode(String code);

  java.util.List<Customer> findByOrganizationId(String organizationId);

  Optional<Customer> findByOrganizationIdAndCode(String organizationId, String code);

  java.util.List<Customer> findByOrganizationIdAndPhoneNumber(
      String organizationId, String phoneNumber);

  Optional<Customer> findByPhoneNumber(String phoneNumber);
}
