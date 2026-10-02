package kr.shnea.hellow.platform;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
  Optional<Attachment> findByOrganizationIdAndFileId(String organizationId, String fileId);

  Optional<Attachment> findByOrganizationIdAndQueueCodeAndRequestId(
      String organizationId, String queueCode, String requestId);

  boolean existsByOrganizationIdAndQueueCodeAndFileId(
      String organizationId, String queueCode, String fileId);
}
