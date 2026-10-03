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

  public TimelineController(
      TimelineRepository timelines,
      WorkspaceAccess access,
      CustomerRepository customers,
      QueueItemRepository queues,kr.shnea.hellow.consultation.ConsultationRepository records,com.fasterxml.jackson.databind.ObjectMapper json) {
    this.timelines = timelines;
    this.access = access;
    this.customers = customers;
    this.queues = queues;
    this.records=records;this.json=json;
  }

  @GetMapping("/customer/{code}")
  public List<Map<String,Object>> customer(@PathVariable String code) {
    var actor = access.require("consultation:read");
    customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    return timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and(BusinessScope.equal("customerCode",code)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")).stream().map(item->view(actor,item)).toList();
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
