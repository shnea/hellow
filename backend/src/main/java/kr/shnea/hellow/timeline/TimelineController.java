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
  private final TimelineRepository timelines;
  private final WorkspaceAccess access;
  private final CustomerRepository customers;
  private final QueueItemRepository queues;
  private final kr.shnea.hellow.consultation.ConsultationRepository records;
  private final com.fasterxml.jackson.databind.ObjectMapper json;
  private final kr.shnea.hellow.customer.CustomerIdentityService identity;

  public TimelineController(
      TimelineRepository timelines,
      WorkspaceAccess access,
      CustomerRepository customers,
      QueueItemRepository queues,kr.shnea.hellow.consultation.ConsultationRepository records,com.fasterxml.jackson.databind.ObjectMapper json,kr.shnea.hellow.customer.CustomerIdentityService identity) {
    this.timelines = timelines;
    this.access = access;
    this.customers = customers;
    this.queues = queues;
    this.records=records;this.json=json;
    this.identity=identity;
  }

  @GetMapping("/customer/{code}")
  public List<Map<String,Object>> customer(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var customer=customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    var codes=identity.relatedCodes(customer);
    var result=new ArrayList<>(timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and((root,query,cb)->root.get("customerCode").in(codes)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().map(item->view(actor,item)).toList());
    var represented=new HashSet<Object>();result.forEach(item->represented.add(item.get("queueCode")));
    for(var q:queues.findAll(BusinessScope.<kr.shnea.hellow.queue.QueueItem>rows(actor).and((root,query,cb)->root.get("customerCode").in(codes)))){
      if(represented.contains(q.getCode()))continue;
      var record=records.findOne(BusinessScope.<kr.shnea.hellow.consultation.Consultation>rows(actor).and(BusinessScope.equal("queueCode",q.getCode())));
      var item=new LinkedHashMap<String,Object>();item.put("id",-q.getId());item.put("queueCode",q.getCode());item.put("createdAt",q.getCreatedAt());item.put("channel",q.getType()==kr.shnea.hellow.queue.QueueItem.ItemType.CALL?"CALL":"TICKET");
      item.put("agentName",q.getAssignedAgent());item.put("title",record.map(r->"상담 기록: "+r.getCategorySub()).orElse("상담 접수 · "+q.getStatus()));item.put("content",record.map(r->r.getMemo()).orElse(q.getSummary()));item.put("tags",record.map(r->r.getTags()).orElse(""));item.put("hasAudio",false);result.add(item);
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
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().map(item->view(actor,item)).toList();
  }
  private Map<String,Object> view(WorkspaceAccess.Actor actor,TimelineItem item){
    Map<String,Object> result=json.convertValue(item,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    if(item.getQueueCode()!=null&&item.getTitle().startsWith("상담 완료: "))records.findOne(BusinessScope.<kr.shnea.hellow.consultation.Consultation>rows(actor)
        .and(BusinessScope.equal("queueCode",item.getQueueCode()))).ifPresent(record->{
          result.put("content",record.getMemo());result.put("tags",record.getTags());
          result.put("title","상담 완료: "+record.getCategorySub()+(record.getResultName()==null?"":" · "+record.getResultName()));
        });
    return result;
  }
}
