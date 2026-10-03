package kr.shnea.hellow.security;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
  List<AuditEvent> findTop100ByOrganizationIdOrderByOccurredAtDesc(String organizationId);
  List<AuditEvent> findTop100ByOrganizationIdIsNullOrderByOccurredAtDesc();
}
