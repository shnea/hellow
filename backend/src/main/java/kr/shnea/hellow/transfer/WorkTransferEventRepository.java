package kr.shnea.hellow.transfer;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface WorkTransferEventRepository extends JpaRepository<WorkTransferEvent,Long> {
  List<WorkTransferEvent> findByOrganizationIdAndTransferIdOrderByIdDesc(String org,String id,Pageable page);
}
