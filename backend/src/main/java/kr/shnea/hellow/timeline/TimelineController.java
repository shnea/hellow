package kr.shnea.hellow.timeline;

import static org.springframework.http.HttpStatus.*;

import java.util.*;
import kr.shnea.hellow.customer.CustomerRepository;
import kr.shnea.hellow.queue.QueueItemRepository;
import kr.shnea.hellow.security.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/timeline")
public class TimelineController {
  private final StaffNames names;
  private final TimelineRepository timelines;
  private final WorkspaceAccess access;
  private final CustomerRepository customers;
  private final QueueItemRepository queues;
  private final kr.shnea.hellow.consultation.ConsultationRepository records;
  private final com.fasterxml.jackson.databind.ObjectMapper json;
  private final kr.shnea.hellow.customer.CustomerIdentityService identity;
  private final kr.shnea.hellow.recording.CallRecordingRepository recordings;

  public TimelineController(
      TimelineRepository timelines,
      WorkspaceAccess access,
      CustomerRepository customers,
      QueueItemRepository queues,kr.shnea.hellow.consultation.ConsultationRepository records,com.fasterxml.jackson.databind.ObjectMapper json,kr.shnea.hellow.customer.CustomerIdentityService identity,kr.shnea.hellow.recording.CallRecordingRepository recordings,StaffNames names) {
    this.names=names;this.timelines = timelines;
    this.access = access;
    this.customers = customers;
    this.queues = queues;
    this.records=records;this.json=json;
    this.identity=identity;this.recordings=recordings;
  }

  @GetMapping("/customer/{code}")
  public List<Map<String,Object>> customer(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var customer=customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    var codes=identity.relatedCodes(customer);
    var result=new ArrayList<>(timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and((root,query,cb)->root.get("customerCode").in(codes)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().filter(item->sourceVisible(actor,item)).map(item->view(actor,item)).toList());
    var represented=new HashSet<Object>();result.forEach(item->represented.add(item.get("queueCode")));
    for(var q:queues.findAll(BusinessScope.<kr.shnea.hellow.queue.QueueItem>rows(actor).and((root,query,cb)->root.get("customerCode").in(codes)))){
      if(represented.contains(q.getCode()))continue;
      var record=records.findOne(BusinessScope.<kr.shnea.hellow.consultation.Consultation>rows(actor).and(BusinessScope.equal("queueCode",q.getCode())));
      var item=new LinkedHashMap<String,Object>();item.put("id",-q.getId());item.put("queueCode",q.getCode());item.put("createdAt",q.getCreatedAt());item.put("channel",q.getType()==kr.shnea.hellow.queue.QueueItem.ItemType.CALL?"CALL":"TICKET");
      item.put("agentName",names.resolve(actor.organizationId(),q.getOwnerIssuer(),q.getOwnerSubject(),q.getAssignedAgent()));item.put("title",record.map(r->"상담 기록: "+r.getCategorySub()).orElse("상담 접수 · "+q.getStatus()));item.put("content",record.map(r->r.getMemo()).orElse(q.getSummary()));item.put("tags",record.map(r->r.getTags()).orElse(""));item.put("hasAudio",false);detail(actor,item,q.getCode());result.add(item);
    }
    result.sort(Comparator.comparing((Map<String,Object> item)->String.valueOf(item.get("createdAt"))).reversed());return result;
  }

  @GetMapping("/queue/{code}")
  public List<Map<String,Object>> queue(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var queue=queues
        .findByOrganizationIdAndCode(actor.organizationId(), code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    actor.requireRow(queue);
    return timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and(BusinessScope.equal("queueCode",code)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().filter(item->sourceVisible(actor,item)).map(item->view(actor,item)).toList();
  }
  private boolean sourceVisible(WorkspaceAccess.Actor actor,TimelineItem item){return item.getQueueCode()==null||records.findByOrganizationIdAndQueueCode(actor.organizationId(),item.getQueueCode()).map(actor::allows).orElse(true);}
  private Map<String,Object> view(WorkspaceAccess.Actor actor,TimelineItem item){
    Map<String,Object> result=json.convertValue(item,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    if(item.getQueueCode()!=null&&item.getTitle().startsWith("상담 완료: "))records.findOne(BusinessScope.<kr.shnea.hellow.consultation.Consultation>rows(actor)
        .and(BusinessScope.equal("queueCode",item.getQueueCode()))).ifPresent(record->{
          result.put("content",record.getMemo());result.put("tags",record.getTags());
          result.put("title","상담 완료: "+record.getCategorySub()+(record.getResultName()==null?"":" · "+record.getResultName()));
        });
    result.put("agentName",names.resolve(actor.organizationId(),item.getOwnerIssuer(),item.getOwnerSubject(),item.getAgentName()));
    detail(actor,result,item.getQueueCode());return result;
  }
  private void detail(WorkspaceAccess.Actor actor,Map<String,Object> view,String code){
    if(code==null)return;
    var record=records.findByOrganizationIdAndQueueCode(actor.organizationId(),code);
    if(record.isPresent()){if(actor.allows(record.get()))view.put("recordId",record.get().getId());}
    else queues.findByOrganizationIdAndCode(actor.organizationId(),code).filter(actor::allows).ifPresent(q->view.put("recordId",-q.getId()));
    recordings.findByOrganizationIdAndQueueCode(actor.organizationId(),code).ifPresent(r->{view.put("recordingStatus",r.getState().name());view.put("hasAudio",r.getState()==kr.shnea.hellow.recording.CallRecording.State.READY);});
  }
  public record QuoteRequest(@jakarta.validation.constraints.NotBlank String targetQueueCode){}
  @PostMapping("/{id}/quote")
  public Map<String,String> quote(@PathVariable long id,@jakarta.validation.Valid @RequestBody QuoteRequest request){
    var reader=access.require("consultation:read");
    String code,content,author,date;
    if(id<0){var source=queues.findById(-id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));reader.requireRow(source);code=source.getCode();content=source.getSummary();author=names.resolve(reader.organizationId(),source.getOwnerIssuer(),source.getOwnerSubject(),source.getAssignedAgent());date=String.valueOf(source.getCreatedAt());}
    else{var source=timelines.findById(id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));reader.requireRow(source);code=source.getQueueCode();content=source.getContent();author=names.resolve(reader.organizationId(),source.getOwnerIssuer(),source.getOwnerSubject(),source.getAgentName());date=String.valueOf(source.getCreatedAt());}
    if(code!=null){var record=records.findByOrganizationIdAndQueueCode(reader.organizationId(),code);if(record.isPresent()){reader.requireRow(record.get());content=record.get().getMemo();}}
    var writer=access.require("consultation:write");
    var target=queues.findByOrganizationIdAndCode(writer.organizationId(),request.targetQueueCode()).orElseThrow(()->new ResponseStatusException(NOT_FOUND));writer.requireRow(target);
    if(target.getStatus()!=kr.shnea.hellow.queue.QueueItem.QueueStatus.PROCESSING||!writer.issuer().equals(target.getOwnerIssuer())||!writer.subject().equals(target.getOwnerSubject()))throw new ResponseStatusException(FORBIDDEN,"현재 담당 상담에만 인용할 수 있습니다.");
    return Map.of("text","출처: "+date+" · "+Objects.toString(author,"")+" · "+Objects.toString(code,"이력 #"+id)+"\n"+Objects.toString(content,""));
  }
}
