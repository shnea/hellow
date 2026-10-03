package kr.shnea.hellow.consultation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ConsultationRevisionRepository extends JpaRepository<ConsultationRevision,Long> {
  List<ConsultationRevision> findByOrganizationIdAndConsultationIdOrderByChangedAtDesc(String org,Long id);
}
