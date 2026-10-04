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
  private final kr.shnea.hellow.security.StaffNames names;
  private final ConsultationRepository records;
  private final ConsultationRevisionRepository revisions;
  private final CustomerRepository customers;
  private final QueueItemRepository queues;
  private final AttachmentRepository attachments;
  private final WorkspaceAccess access;
  private final ObjectMapper json;
  private final kr.shnea.hellow.content.CatalogService catalog;
  private final ConsultationHistoryQuery history;
  private final kr.shnea.hellow.customer.CustomerIdentityService customerIdentity;
  private final kr.shnea.hellow.recording.CallRecordingRepository recordings;
  public CustomerConsultationController(ConsultationRepository records,ConsultationRevisionRepository revisions,
      CustomerRepository customers,QueueItemRepository queues,AttachmentRepository attachments,WorkspaceAccess access,ObjectMapper json,kr.shnea.hellow.content.CatalogService catalog,ConsultationHistoryQuery history,kr.shnea.hellow.customer.CustomerIdentityService customerIdentity,kr.shnea.hellow.recording.CallRecordingRepository recordings,kr.shnea.hellow.security.StaffNames names) {
    this.names=names;this.records=records;this.revisions=revisions;this.customers=customers;this.queues=queues;
    this.attachments=attachments;this.access=access;this.json=json;
    this.catalog=catalog;
    this.history=history;this.customerIdentity=customerIdentity;this.recordings=recordings;
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
  public HistoryPage history(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="") String search,
      @RequestParam(defaultValue="all") String scope,@RequestParam(defaultValue="") String name,@RequestParam(defaultValue="") String phone,
      @RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String assignee,
      @RequestParam(required=false) java.time.Instant from,@RequestParam(required=false) java.time.Instant to){
    var actor=access.require("consultation:read");
    if("all".equals(scope)&&actor.dataScope()==kr.shnea.hellow.security.DataScope.SELF)
      throw new ResponseStatusException(FORBIDDEN,"전체 상담 이력 조회 범위가 없습니다.");
    if(page<0||page>100000||java.util.stream.Stream.of(search,name,phone,assignee).anyMatch(s->s.length()>100)
        ||!Set.of("all","mine").contains(scope)||!Set.of("","WAITING","PROCESSING","COMPLETED","CANCELLED","IN_PROGRESS","ESCALATED").contains(status)
        ||from!=null&&to!=null&&!from.isBefore(to))throw new ResponseStatusException(BAD_REQUEST);
    var reader="mine".equals(scope)?actor.withScope(kr.shnea.hellow.security.DataScope.SELF):actor;
    var ids=history.ids(reader,page,search,name,phone,status,assignee,from,to);
    return new HistoryPage(ids.stream().limit(50).map(id->id<0?intakeView(reader,-id):view(reader,requireRecord(reader,id))).toList(),page,ids.size()>50);
  }
  /** An accepted standalone transfer can be opened without granting access to other customer records. */
  @GetMapping("/{id}")
  public Map<String,Object> get(@PathVariable Long id) {
    var actor=access.require("consultation:read");
    if(id<0)return intakeView(actor,-id);
    return view(actor,requireRecord(actor,id));
  }
  @GetMapping("/intake/{code}")
  public Map<String,Object> intake(@PathVariable String code){var actor=access.require("consultation:read");var q=queues.findByOrganizationIdAndCode(actor.organizationId(),code).orElseThrow(()->new ResponseStatusException(NOT_FOUND));return intakeView(actor,q.getId());}
  private Map<String,Object> intakeView(WorkspaceAccess.Actor actor,long id){
    var q=queues.findById(id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));actor.requireRow(q);
    var existing=records.findByOrganizationIdAndQueueCode(actor.organizationId(),q.getCode());
    if(existing.isPresent()){actor.requireRow(existing.get());return view(actor,existing.get());}
    var result=new LinkedHashMap<String,Object>();result.put("id",-id);result.put("version",0);result.put("queueCode",q.getCode());result.put("customerCode",q.getCustomerCode());
    result.put("customerName",q.getCustomerName());result.put("phoneNumber",q.getPhoneNumber());result.put("companyName",q.getCompanyName());result.put("customerType",q.getCustomerType());result.put("customerRegistered",q.getCustomerCode()!=null);
    result.put("contactVersion",q.getVersion());result.put("contactEditable",actor.can("customer:write",q));result.put("createdAt",q.getCreatedAt());result.put("receivedAt",q.getCreatedAt());result.put("type",q.getType());result.put("processingStatus",q.getStatus());result.put("agentName",names.resolve(actor.organizationId(),q.getOwnerIssuer(),q.getOwnerSubject(),q.getAssignedAgent()));
    result.put("categoryMain","일반 상담");result.put("categorySub",q.getInquiryType()==null?"일반 문의":q.getInquiryType());result.put("status",q.getStatus());result.put("memo",q.getSummary());result.put("tags","");
    result.put("chatEnabled",q.isChatEnabled());
    boolean processing=q.getStatus()==QueueItem.QueueStatus.PROCESSING||q.getStatus()==QueueItem.QueueStatus.WAITING;
    result.put("processing",processing);result.put("editable",actor.can("consultation:write",q)&&!processing);recordingStatus(result,actor,q.getCode());return result;
  }
  private Map<String,Object> view(WorkspaceAccess.Actor actor,Consultation record) {
    Map<String,Object> view=json.convertValue(record,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    var intake=record.getQueueCode()==null?Optional.<QueueItem>empty():queues.findByOrganizationIdAndCode(actor.organizationId(),record.getQueueCode());
    view.put("agentName",names.resolve(actor.organizationId(),record.getOwnerIssuer(),record.getOwnerSubject(),record.getAgentName()));
    view.put("receivedAt",intake.map(QueueItem::getCreatedAt).orElse(record.getCreatedAt()));view.put("type",intake.map(q->q.getType().name()).orElse("MANUAL"));
    view.put("processingStatus",intake.map(q->q.getStatus().name()).orElse(record.getStatus().name()));
    view.put("chatEnabled",intake.map(QueueItem::isChatEnabled).orElse(false));
    var customer=record.getCustomerCode()==null?Optional.<kr.shnea.hellow.customer.Customer>empty():customers.findByOrganizationIdAndCode(actor.organizationId(),record.getCustomerCode());
    view.put("customerName",customer.map(c->c.getName()).orElseGet(()->intake.map(QueueItem::getCustomerName).orElse("상담 고객")));
    view.put("phoneNumber",customer.map(c->c.getPhoneNumber()).orElseGet(()->intake.map(QueueItem::getPhoneNumber).orElse("")));
    view.put("companyName",customer.map(c->c.getCompany()).orElseGet(()->intake.map(QueueItem::getCompanyName).orElse("")));
    view.put("customerType",customer.map(c->c.getCustomerType()).orElseGet(()->intake.map(QueueItem::getCustomerType).orElse(kr.shnea.hellow.customer.Customer.CustomerType.INDIVIDUAL)));
    view.put("customerRegistered",customer.map(c->c.isRegistered()).orElse(false));
    view.put("contactVersion",intake.map(QueueItem::getVersion).orElse(0L));
    view.put("contactEditable",customer.map(c->actor.can("customer:write",c)).orElseGet(()->intake.map(q->actor.can("customer:write",q)).orElse(false)));
    view.put("canRequestFollowUp",intake.map(q->actor.can("followup:read",q)&&actor.can("followup:write",q)).orElse(false));
    boolean processing=intake.map(q->q.getStatus()==QueueItem.QueueStatus.PROCESSING||q.getStatus()==QueueItem.QueueStatus.WAITING).orElse(false);
    view.put("processing",processing);view.put("editable",actor.can("consultation:write",record)&&!processing);recordingStatus(view,actor,record.getQueueCode());return view;
  }
  private void recordingStatus(Map<String,Object> result,WorkspaceAccess.Actor actor,String code){if(code!=null)recordings.findByOrganizationIdAndQueueCode(actor.organizationId(),code).ifPresent(r->result.put("recordingStatus",r.getState().name()));}
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
  public record RevisionView(@com.fasterxml.jackson.annotation.JsonUnwrapped @com.fasterxml.jackson.annotation.JsonIgnoreProperties("actorName") ConsultationRevision revision,String actorName){}
  @GetMapping("/{id}/revisions")
  public List<RevisionView> revisions(@PathVariable Long id) {
    var actor=access.require("consultation:read");requireRecord(actor,id);
    return revisions.findByOrganizationIdAndConsultationIdOrderByChangedAtDesc(actor.organizationId(),id).stream().map(r->new RevisionView(r,names.resolve(actor.organizationId(),actor.issuer(),r.getActorSubject(),r.getActorName()))).toList();
  }
  @PutMapping("/{id}")
  @Transactional
  public Consultation update(@PathVariable Long id,@Valid @RequestBody ConsultationController.SaveRequest r) throws com.fasterxml.jackson.core.JsonProcessingException {
    var actor=access.require("consultation:write");customerIdentity.lockOrganization(actor.organizationId());var record=requireRecord(actor,id);
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
    if(record.getQueueCode()!=null)customerIdentity.onSave(queues.lockByCode(actor.organizationId(),record.getQueueCode()).orElseThrow(),actor);
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
