package kr.shnea.hellow.consultation;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationRepository extends JpaRepository<Consultation, Long> {
  Optional<Consultation> findByOrganizationIdAndId(String organizationId, Long id);
  Optional<Consultation> findByRequestKey(String requestKey);
  Optional<Consultation> findByOrganizationIdAndQueueCode(String organizationId, String queueCode);

  List<Consultation> findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(
      String organizationId, String customerCode);
}
