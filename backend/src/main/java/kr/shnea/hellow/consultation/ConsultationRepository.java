package kr.shnea.hellow.consultation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConsultationRepository extends JpaRepository<Consultation, Long> {
    List<Consultation> findByCustomerCodeOrderByCreatedAtDesc(String customerCode);
}
