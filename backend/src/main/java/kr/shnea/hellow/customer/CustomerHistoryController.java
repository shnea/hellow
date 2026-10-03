package kr.shnea.hellow.customer;

import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.springframework.data.domain.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/customers/{customerCode}/history")
public class CustomerHistoryController {
  private final CustomerRepository customers;private final QueueItemRepository queues;
  private final CustomerHistoryLinkRepository links;private final CustomerHistoryService history;
  private final WorkspaceAccess access;private final AuditEvents audit;
  public CustomerHistoryController(CustomerRepository customers,QueueItemRepository queues,CustomerHistoryLinkRepository links,
      CustomerHistoryService history,WorkspaceAccess access,AuditEvents audit){
    this.customers=customers;this.queues=queues;this.links=links;this.history=history;this.access=access;this.audit=audit;
  }
  public record Candidate(String queueCode,long queueVersion,Long recordVersion,LocalDateTime createdAt,String customerName,
      String phoneNumber,String type,String agentName,String category,String result){}
  @GetMapping("/candidates")
  public Map<String,Object> candidates(@PathVariable String customerCode,@RequestParam(required=false)String phone,
      @RequestParam(defaultValue="0") @Min(0) int page){
    var writer=access.require("customer:write");var actor=access.require("consultation:write");var reader=access.require("consultation:read");
    var customer=customer(writer,customerCode);String key=PhoneNumbers.key(phone==null?customer.getPhoneNumber():phone);
    if(key.length()<7||key.length()>20)throw new ResponseStatusException(BAD_REQUEST,"연락처 숫자를 7~20자리로 입력해 주세요.");
    var specification=BusinessScope.<QueueItem>rows(writer).and(BusinessScope.rows(actor)).and(BusinessScope.rows(reader))
      .and(BusinessScope.equal("phoneKey",key)).and(BusinessScope.equal("status",QueueItem.QueueStatus.COMPLETED))
      .and((root,query,cb)->cb.isNull(root.get("customerCode")));
    var rows=queues.findAll(specification,PageRequest.of(Math.min(page,10000),20,Sort.by(Sort.Direction.DESC,"createdAt").and(Sort.by(Sort.Direction.DESC,"id"))));
    var candidates=new ArrayList<Candidate>();
    for(var q:rows){var record=history.record(q);var timeline=history.timeline(q);
      if(record==null&&timeline.isEmpty())continue;
      if(record!=null&&(!actor.allows(record)||!reader.allows(record)||record.getCustomerCode()!=null))continue;
      if(timeline.stream().anyMatch(t->!actor.allows(t)||!reader.allows(t)||t.getCustomerCode()!=null))continue;
      candidates.add(new Candidate(q.getCode(),q.getVersion(),record==null?null:record.getVersion(),q.getCreatedAt(),q.getCustomerName(),
        q.getPhoneNumber(),q.getType().name(),q.getAssignedAgent(),record==null?null:record.getCategorySub(),record==null?null:record.getResultName()));
    }
    return Map.of("items",candidates,"hasNext",rows.hasNext(),"page",rows.getNumber());
  }
  public record Selection(@NotBlank @Size(max=64) String queueCode,@NotNull @Min(0) Long queueVersion,@Min(0) Long recordVersion){}
  public record LinkRequest(@NotEmpty @Size(max=20) List<@Valid Selection> items){}
  @PostMapping("/links") @Transactional
  public List<CustomerHistoryLink> link(@PathVariable String customerCode,@Valid @RequestBody LinkRequest request){
    var writer=access.require("customer:write");var actor=access.require("consultation:write");var reader=access.require("consultation:read");customer(writer,customerCode);
    if(request.items().stream().map(Selection::queueCode).distinct().count()!=request.items().size())throw new ResponseStatusException(BAD_REQUEST);
    var result=new ArrayList<CustomerHistoryLink>();
    // Every batch locks interactions in the same order and either commits all associations or none.
    for(var selection:request.items().stream().sorted(Comparator.comparing(Selection::queueCode)).toList()){
      var q=queue(writer,actor,selection.queueCode());
      reader.requireRow(q);if(!history.readable(q,reader))throw new ResponseStatusException(NOT_FOUND);
      if(q.getCustomerCode()!=null)throw new ResponseStatusException(CONFLICT,"이미 고객이 연결된 이력입니다. 목록을 다시 조회해 주세요.");
      checkVersions(q,selection);
      var record=history.record(q);if(record==null&&history.timeline(q).isEmpty())throw new ResponseStatusException(CONFLICT,"연결할 상담 기록이 없습니다.");
      var link=new CustomerHistoryLink(writer,q.getCode(),customerCode,q.isRegistered());
      history.synchronize(q,null,customerCode,actor,true);q.associateCustomer(customerCode,true);queues.saveAndFlush(q);links.save(link);result.add(link);
      audit.record(writer.organizationId(),"customer.history.link",link.getId(),"customer="+customerCode+",queue="+q.getCode());
    }
    return result;
  }
  public record LinkView(String id,String queueCode,String actorName,java.time.Instant linkedAt,java.time.Instant undoneAt,long queueVersion,Long recordVersion,
      String customerName,String phoneNumber,LocalDateTime createdAt,String category){}
  @GetMapping("/links")
  public List<LinkView> links(@PathVariable String customerCode){
    var writer=access.require("customer:write");var actor=access.require("consultation:write");var reader=access.require("consultation:read");customer(writer,customerCode);
    var result=new ArrayList<LinkView>();
    for(var link:links.findByOrganizationIdAndCustomerCodeOrderByLinkedAtDesc(writer.organizationId(),customerCode)){
      var q=queues.findByOrganizationIdAndCode(writer.organizationId(),link.getQueueCode()).orElse(null);
      if(q==null||!writer.allows(q)||!actor.allows(q)||!reader.allows(q))continue;
      var record=history.record(q);if(record!=null&&(!actor.allows(record)||!reader.allows(record)))continue;
      result.add(new LinkView(link.getId(),q.getCode(),link.getActorName(),link.getLinkedAt(),link.getUndoneAt(),q.getVersion(),record==null?null:record.getVersion(),q.getCustomerName(),q.getPhoneNumber(),q.getCreatedAt(),record==null?null:record.getCategorySub()));
    }
    return result;
  }
  @PostMapping("/links/{id}/undo") @Transactional
  public void undo(@PathVariable String customerCode,@PathVariable String id,@Valid @RequestBody Selection selection){
    var writer=access.require("customer:write");var actor=access.require("consultation:write");var reader=access.require("consultation:read");customer(writer,customerCode);
    var link=links.findByOrganizationIdAndId(writer.organizationId(),id).filter(l->l.getCustomerCode().equals(customerCode)).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    if(!link.getQueueCode().equals(selection.queueCode()))throw new ResponseStatusException(BAD_REQUEST);
    var q=queue(writer,actor,selection.queueCode());
    reader.requireRow(q);if(!history.readable(q,reader))throw new ResponseStatusException(NOT_FOUND);
    if(link.getUndoneAt()!=null)return;
    if(!customerCode.equals(q.getCustomerCode()))throw new ResponseStatusException(CONFLICT,"고객 연결이 변경됐습니다.");
    checkVersions(q,selection);history.synchronize(q,customerCode,null,actor,true);q.associateCustomer(null,link.isOriginalRegistered());queues.saveAndFlush(q);link.undo();links.save(link);
    audit.record(writer.organizationId(),"customer.history.undo",link.getId(),"customer="+customerCode+",queue="+q.getCode());
  }
  private void checkVersions(QueueItem q,Selection selection){
    var record=history.record(q);
    if(!Objects.equals(q.getVersion(),selection.queueVersion())||!Objects.equals(record==null?null:record.getVersion(),selection.recordVersion()))
      throw new ResponseStatusException(CONFLICT,"다른 작업에서 이력이 변경됐습니다. 선택을 보존하고 최신 목록을 확인해 주세요.");
  }
  private QueueItem queue(WorkspaceAccess.Actor writer,WorkspaceAccess.Actor actor,String code){
    var q=queues.lockByCode(writer.organizationId(),code).orElseThrow(()->new ResponseStatusException(NOT_FOUND));writer.requireRow(q);actor.requireRow(q);
    if(q.getStatus()!=QueueItem.QueueStatus.COMPLETED)throw new ResponseStatusException(CONFLICT,"완료된 미연결 이력만 연결할 수 있습니다.");return q;
  }
  private Customer customer(WorkspaceAccess.Actor writer,String code){return customers.findOne(BusinessScope.customers(writer).and(BusinessScope.equal("code",code)))
    .filter(Customer::isRegistered).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
}
