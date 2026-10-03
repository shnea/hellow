package kr.shnea.hellow.customer;

import static org.springframework.http.HttpStatus.*;
import java.util.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerHistoryService {
  private final ConsultationRepository records;
  private final TimelineRepository timelines;
  private final kr.shnea.hellow.followup.FollowUpRepository followups;
  public CustomerHistoryService(ConsultationRepository records,TimelineRepository timelines,kr.shnea.hellow.followup.FollowUpRepository followups){this.records=records;this.timelines=timelines;this.followups=followups;}
  public Consultation record(QueueItem q){return records.findByOrganizationIdAndQueueCode(q.getOrganizationId(),q.getCode()).orElse(null);}
  public List<TimelineItem> timeline(QueueItem q){return timelines.findByOrganizationIdAndQueueCodeOrderByCreatedAtDesc(q.getOrganizationId(),q.getCode());}
  public boolean readable(QueueItem q,WorkspaceAccess.Actor reader){
    var record=record(q);return (record==null||reader.allows(record))&&timeline(q).stream().allMatch(reader::allows);
  }
  public void synchronize(QueueItem q,String expected,String target,WorkspaceAccess.Actor actor,boolean historical){
    var record=record(q);var items=timeline(q);
    if(record!=null){
      if(historical)actor.requireRow(record);
      requireAssociation(record.getCustomerCode(),expected,target);
      record.associateCustomer(target);records.saveAndFlush(record);
    }
    for(var item:items){
      if(historical)actor.requireRow(item);
      requireAssociation(item.getCustomerCode(),expected,target);item.associateCustomer(target);
    }
    timelines.saveAll(items);
    var actions=followups.findByOrganizationIdAndQueueCode(q.getOrganizationId(),q.getCode());
    for(var action:actions){
      if(historical)actor.requireRow(action);
      requireAssociation(action.getCustomerCode(),expected,target);action.associateCustomer(target);
    }
    followups.saveAll(actions);
  }
  private void requireAssociation(String current,String expected,String target){
    if(!Objects.equals(current,expected)&&!Objects.equals(current,target))
      throw new ResponseStatusException(CONFLICT,"이력의 고객 연결이 변경됐습니다. 최신 목록을 확인해 주세요.");
  }
}
