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
  public CustomerConsultationController(ConsultationRepository records,ConsultationRevisionRepository revisions,
      CustomerRepository customers,QueueItemRepository queues,AttachmentRepository attachments,WorkspaceAccess access,ObjectMapper json) {
    this.records=records;this.revisions=revisions;this.customers=customers;this.queues=queues;
    this.attachments=attachments;this.access=access;this.json=json;
  }
  @GetMapping("/customer/{code}")
  public List<Consultation> list(@PathVariable String code) {
    var actor=access.require("consultation:read"); requireCustomer(actor.organizationId(),code);
    return records.findByOrganizationIdAndCustomerCodeOrderByCreatedAtDesc(actor.organizationId(),code);
  }
  public record CreateRequest(@NotBlank String customerCode,@NotNull UUID requestId) {}
  @PostMapping
  @Transactional
  public Consultation create(@Valid @RequestBody CreateRequest r) {
    var actor=access.require("consultation:write");requireCustomer(actor.organizationId(),r.customerCode());
    String key=UUID.nameUUIDFromBytes((actor.organizationId()+":"+actor.subject()+":"+r.requestId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
    var prior=records.findByRequestKey(key);
    if(prior.isPresent()) {
      if(!Objects.equals(prior.get().getCustomerCode(),r.customerCode())) throw new ResponseStatusException(CONFLICT);
      return prior.get();
    }
    var record=new Consultation(r.customerCode(),"일반 상담","일반 문의",Consultation.ConsultationStatus.IN_PROGRESS,"","",actor.name(),0);
    record.setOrganizationId(actor.organizationId());record.bind(null,actor.subject());record.setRequestKey(key);
    return records.saveAndFlush(record);
  }
  @GetMapping("/{id}/revisions")
  public List<ConsultationRevision> revisions(@PathVariable Long id) {
    var actor=access.require("consultation:read");requireRecord(actor.organizationId(),id);
    return revisions.findByOrganizationIdAndConsultationIdOrderByChangedAtDesc(actor.organizationId(),id);
  }
  @PutMapping("/{id}")
  @Transactional
  public Consultation update(@PathVariable Long id,@Valid @RequestBody ConsultationController.SaveRequest r) throws com.fasterxml.jackson.core.JsonProcessingException {
    var actor=access.require("consultation:write");var record=requireRecord(actor.organizationId(),id);
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
    record.update(record.getCustomerCode(),r.categoryMain(),r.categorySub(),status,r.memo(),r.editorDocument().toString(),r.tags(),record.getCallDurationSeconds());
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
  private Consultation requireRecord(String org,Long id){return records.findByOrganizationIdAndId(org,id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private void requireCustomer(String org,String code){if(customers.findByOrganizationIdAndCode(org,code).isEmpty())throw new ResponseStatusException(NOT_FOUND);}
}
