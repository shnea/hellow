package kr.shnea.hellow.consultation;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsultationRepository extends JpaRepository<Consultation, Long> {
  Optional<Consultation> findByOrganizationIdAndQueueCode(String organizationId, String queueCode);

  List<Consultation> findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(
      String organizationId, String customerCode);
}
