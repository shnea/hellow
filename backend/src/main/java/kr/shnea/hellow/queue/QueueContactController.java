package kr.shnea.hellow.queue;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Contact details belong to the intake even before a customer registry entry exists. */
@RestController
@RequestMapping("/api/queue")
public class QueueContactController {
  private final QueueItemRepository queues;private final WorkspaceAccess access;private final AuditEvents audit;
  public QueueContactController(QueueItemRepository queues,WorkspaceAccess access,AuditEvents audit){this.queues=queues;this.access=access;this.audit=audit;}
  public record Contact(@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=100) String name,
      @Size(max=200) String company,@NotBlank @Size(max=30) String phoneNumber,@NotNull Customer.CustomerType customerType){}
  @PutMapping("/{code}/contact") @Transactional
  public QueueItem update(@PathVariable String code,@Valid @RequestBody Contact request){
    var actor=access.require("customer:write");
    var q=queues.lockByCode(actor.organizationId(),code).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    actor.requireRow(q);
    if(q.getCustomerCode()!=null)throw new ResponseStatusException(CONFLICT,"등록 고객의 정보 수정에서 변경해 주세요.");
    if(!java.util.Objects.equals(q.getVersion(),request.expectedVersion()))throw new ResponseStatusException(CONFLICT,"고객 정보가 변경되었습니다. 입력을 보존하고 최신 정보를 확인해 주세요.");
    q.updateUnregisteredContact(request.name().trim(),request.company(),request.phoneNumber().trim(),request.customerType());
    queues.saveAndFlush(q);audit.record(actor.organizationId(),"queue.contact.update",code,"version="+q.getVersion());return q;
  }
}
