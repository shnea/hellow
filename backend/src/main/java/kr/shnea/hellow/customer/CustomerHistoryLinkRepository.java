package kr.shnea.hellow.customer;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CustomerHistoryLinkRepository extends JpaRepository<CustomerHistoryLink,String>{
  Optional<CustomerHistoryLink> findByOrganizationIdAndId(String organizationId,String id);
  List<CustomerHistoryLink> findByOrganizationIdAndCustomerCodeOrderByLinkedAtDesc(String organizationId,String customerCode);
}
