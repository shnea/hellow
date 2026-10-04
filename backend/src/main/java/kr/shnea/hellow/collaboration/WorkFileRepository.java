package kr.shnea.hellow.collaboration;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkFileRepository extends JpaRepository<WorkFile, String> {
  Optional<WorkFile>
      findByOrganizationIdAndOwnerKindAndOwnerIdAndUploaderIssuerAndUploaderSubjectAndRequestId(
          String org, String kind, String owner, String issuer, String subject, String request);

  Optional<WorkFile> findByOrganizationIdAndOwnerKindAndOwnerIdAndId(
      String org, String kind, String owner, String id);
}
