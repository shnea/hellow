package kr.shnea.hellow.consultation;

import static org.springframework.http.HttpStatus.*;
import com.fasterxml.jackson.databind.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.customer.CustomerRepository;
import kr.shnea.hellow.platform.AttachmentRepository;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.WorkspaceAccess;
import kr.shnea.hellow.security.BusinessScope;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Customer records remain accessible independently of the live queue. */
@RestController
@RequestMapping("/api/consultations")
public class CustomerConsultationController {
  private final ConsultationRepository records;
  private final ConsultationRevisionRepository revisions;
  private final CustomerRepository customers;
  private final QueueItemRepository queues;
  private final AttachmentRepository attachments;
  private final WorkspaceAccess access;
  private final ObjectMapper json;
  private final kr.shnea.hellow.content.CatalogService catalog;
  public CustomerConsultationController(ConsultationRepository records,ConsultationRevisionRepository revisions,
      CustomerRepository customers,QueueItemRepository queues,AttachmentRepository attachments,WorkspaceAccess access,ObjectMapper json,kr.shnea.hellow.content.CatalogService catalog) {
    this.records=records;this.revisions=revisions;this.customers=customers;this.queues=queues;
    this.attachments=attachments;this.access=access;this.json=json;
    this.catalog=catalog;
  }
  @GetMapping("/customer/{code}")
  public List<Map<String,Object>> list(@PathVariable String code) {
    var actor=access.require("consultation:read"); requireCustomer(actor,code);
    return records.findAll(BusinessScope.<Consultation>rows(actor).and(BusinessScope.equal("customerCode",code)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().map(record->{
          return view(actor,record);
        }).toList();
  }
  public record HistoryPage(List<Map<String,Object>> items,int page,boolean hasMore){}
  @GetMapping
  public HistoryPage history(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="") String search){
    var actor=access.require("consultation:read");
    if(page<0||page>100000||search.length()>100)throw new ResponseStatusException(BAD_REQUEST);
    org.springframework.data.jpa.domain.Specification<Consultation> scope=BusinessScope.rows(actor);
    if(!search.isBlank())scope=scope.and((root,query,cb)->{
      String term="%"+search.trim().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
      var intake=query.subquery(Integer.class);var q=intake.from(QueueItem.class);
      intake.select(cb.literal(1)).where(cb.equal(q.get("organizationId"),actor.organizationId()),cb.equal(q.get("code"),root.get("queueCode")),
          cb.or(cb.like(cb.lower(q.get("customerName")),term,'\\'),cb.like(q.get("phoneNumber"),term,'\\')));
      var customer=query.subquery(Integer.class);var c=customer.from(kr.shnea.hellow.customer.Customer.class);
      customer.select(cb.literal(1)).where(cb.equal(c.get("organizationId"),actor.organizationId()),cb.equal(c.get("code"),root.get("customerCode")),
          cb.or(cb.like(cb.lower(c.get("name")),term,'\\'),cb.like(c.get("phoneNumber"),term,'\\')));
      return cb.or(cb.exists(intake),cb.exists(customer),cb.like(cb.lower(root.get("categorySub")),term,'\\'));
    });
    var rows=records.findAll(scope,org.springframework.data.domain.PageRequest.of(page,50,org.springframework.data.domain.Sort.by(
        org.springframework.data.domain.Sort.Order.desc("createdAt"),org.springframework.data.domain.Sort.Order.desc("id"))));
    return new HistoryPage(rows.getContent().stream().map(r->view(actor,r)).toList(),page,rows.hasNext());
  }
  /** An accepted standalone transfer can be opened without granting access to other customer records. */
  @GetMapping("/{id}")
  public Map<String,Object> get(@PathVariable Long id) {
    var actor=access.require("consultation:read");
    return view(actor,requireRecord(actor,id));
  }
  private Map<String,Object> view(WorkspaceAccess.Actor actor,Consultation record) {
    Map<String,Object> view=json.convertValue(record,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    var intake=record.getQueueCode()==null?Optional.<QueueItem>empty():queues.findByOrganizationIdAndCode(actor.organizationId(),record.getQueueCode());
    var customer=record.getCustomerCode()==null?Optional.<kr.shnea.hellow.customer.Customer>empty():customers.findByOrganizationIdAndCode(actor.organizationId(),record.getCustomerCode());
    view.put("customerName",customer.map(c->c.getName()).orElseGet(()->intake.map(QueueItem::getCustomerName).orElse("상담 고객")));
    view.put("phoneNumber",customer.map(c->c.getPhoneNumber()).orElseGet(()->intake.map(QueueItem::getPhoneNumber).orElse("")));
    view.put("companyName",customer.map(c->c.getCompany()).orElseGet(()->intake.map(QueueItem::getCompanyName).orElse("")));
    view.put("customerType",customer.map(c->c.getCustomerType()).orElseGet(()->intake.map(QueueItem::getCustomerType).orElse(kr.shnea.hellow.customer.Customer.CustomerType.INDIVIDUAL)));
    view.put("customerRegistered",customer.map(c->c.isRegistered()).orElse(false));
    view.put("contactVersion",intake.map(QueueItem::getVersion).orElse(0L));
    view.put("contactEditable",customer.map(c->actor.can("customer:write",c)).orElseGet(()->intake.map(q->actor.can("customer:write",q)).orElse(false)));
    boolean processing=intake.map(q->q.getStatus()==QueueItem.QueueStatus.PROCESSING||q.getStatus()==QueueItem.QueueStatus.WAITING).orElse(false);
    view.put("processing",processing);view.put("editable",actor.can("consultation:write",record)&&!processing);return view;
  }
  public record CreateRequest(@NotBlank String customerCode,@NotNull UUID requestId) {}
  @PostMapping
  @Transactional
  public Consultation create(@Valid @RequestBody CreateRequest r) {
    var actor=access.require("consultation:write");requireCustomer(actor,r.customerCode());
    String key=UUID.nameUUIDFromBytes((actor.organizationId()+":"+actor.subject()+":"+r.requestId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
    var prior=records.findByRequestKey(key);
    if(prior.isPresent()) {
      actor.requireRow(prior.get());
      if(!Objects.equals(prior.get().getCustomerCode(),r.customerCode())) throw new ResponseStatusException(CONFLICT);
      return prior.get();
    }
    var record=new Consultation(r.customerCode(),"일반 상담","일반 문의",Consultation.ConsultationStatus.IN_PROGRESS,"","",actor.name(),0);
    record.setOrganizationId(actor.organizationId());record.bind(null,actor.subject());record.setRequestKey(key);
    record.assignOwner(actor);
    record.classify(catalog.initial(actor.organizationId()));
    return records.saveAndFlush(record);
  }
  @GetMapping("/{id}/revisions")
  public List<ConsultationRevision> revisions(@PathVariable Long id) {
    var actor=access.require("consultation:read");requireRecord(actor,id);
    return revisions.findByOrganizationIdAndConsultationIdOrderByChangedAtDesc(actor.organizationId(),id);
  }
  @PutMapping("/{id}")
  @Transactional
  public Consultation update(@PathVariable Long id,@Valid @RequestBody ConsultationController.SaveRequest r) throws com.fasterxml.jackson.core.JsonProcessingException {
    var actor=access.require("consultation:write");var record=requireRecord(actor,id);
    // An ongoing interaction must use its owner's queue save endpoint, so completion remains atomic.
    if(record.getQueueCode()!=null) {
      var q=queues.findByOrganizationIdAndCode(actor.organizationId(),record.getQueueCode()).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
      if(q.getStatus()==QueueItem.QueueStatus.PROCESSING || q.getStatus()==QueueItem.QueueStatus.WAITING)
        throw new ResponseStatusException(CONFLICT,"진행 중인 상담은 대기열에서 저장·완료해 주세요.");
    }
    if(!Objects.equals(record.getVersion(),r.expectedVersion())) throw new ResponseStatusException(CONFLICT,"다른 창에서 변경된 기록입니다. 입력을 보존하고 최신 기록을 확인해 주세요.");
    if(!"shnea-editor".equals(r.editorDocument().path("format").asText()) || !r.editorDocument().path("content").isObject())
      throw new ResponseStatusException(BAD_REQUEST,"에디터 문서 형식을 확인해 주세요.");
    validateFiles(r.editorDocument(),record);
    revisions.save(new ConsultationRevision(record,actor.subject(),actor.name(),json.writeValueAsString(record)));
    var status=record.getStatus();
    if(status==Consultation.ConsultationStatus.IN_PROGRESS && r.complete()) status=Consultation.ConsultationStatus.COMPLETED;
    var classification=catalog.select(actor.organizationId(),r.categoryId(),r.resultId(),record,r.categoryMain(),r.categorySub(),status==Consultation.ConsultationStatus.COMPLETED);
    record.update(record.getCustomerCode(),r.categoryMain(),r.categorySub(),status,r.memo(),r.editorDocument().toString(),r.tags(),record.getCallDurationSeconds());
    record.classify(classification);
    return records.saveAndFlush(record);
  }
  private void validateFiles(JsonNode node,Consultation record) {
    if(node.isObject() && node.hasNonNull("fileId")) {
      var file=attachments.findByOrganizationIdAndFileId(record.getOrganizationId(),node.get("fileId").asText()).orElseThrow(()->new ResponseStatusException(FORBIDDEN));
      if(!Objects.equals(file.getQueueCode(),"record-"+record.getId()) && !Objects.equals(file.getQueueCode(),record.getQueueCode()))
        throw new ResponseStatusException(FORBIDDEN,"다른 상담의 첨부파일입니다.");
    }
    node.elements().forEachRemaining(child->validateFiles(child,record));
  }
  private Consultation requireRecord(WorkspaceAccess.Actor actor,Long id){return records.findOne(BusinessScope.<Consultation>rows(actor).and(BusinessScope.equal("id",id))).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private void requireCustomer(WorkspaceAccess.Actor actor,String code){if(customers.findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code))).isEmpty())throw new ResponseStatusException(NOT_FOUND);}
}
