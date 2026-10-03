package kr.shnea.hellow.transfer;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface WorkTransferRepository extends JpaRepository<WorkTransfer,String>,JpaSpecificationExecutor<WorkTransfer> {
  Optional<WorkTransfer> findByRequestKey(String key);
  List<WorkTransfer> findByOrganizationIdAndStatus(String org,WorkTransfer.Status status);
  boolean existsByOrganizationIdAndConsultationIdAndStatus(String org,Long id,WorkTransfer.Status status);
}
