package kr.shnea.hellow.followup;

import java.time.Instant;
import java.util.*;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Called under routing's global -> organization -> queue locks, also used by acceptance. */
@Service
public class WaitingCallCallbacks {
  private final FollowUpRepository tasks;
  private final FollowUpEventRepository events;
  private final ObjectMapper json;
  public WaitingCallCallbacks(FollowUpRepository tasks,FollowUpEventRepository events,ObjectMapper json){this.tasks=tasks;this.events=events;this.json=json;}

  @Transactional(propagation=Propagation.MANDATORY)
  public void convert(QueueItem q,Instant now){
    if(!q.callbackDue(now)||q.getCallbackFollowUpId()!=null||q.supportExpired(now))return;
    String key=UUID.nameUUIDFromBytes(("waiting-call-callback:"+q.getOrganizationId()+":"+q.getCode()).getBytes(StandardCharsets.UTF_8)).toString();
    var task=tasks.findByRequestKey(key).orElse(null);
    if(task==null){
      var system=new WorkspaceAccess.Actor(q.getOrganizationId(),"waiting-call-callback","자동 콜백 접수","hellow:system",null,DataScope.ORGANIZATION,Set.of(),Map.of());
      task=new FollowUpAction(q.getCustomerCode(),"CALLBACK","미응답 상담 콜백",q.getSummary());
      task.setOrganizationId(q.getOrganizationId());task.setQueueCode(q.getCode());
      // No employee owns this request until an authorized dispatcher assigns it.
      task.initialize(system,now,null,null,key,null);tasks.saveAndFlush(task);
      try{events.save(new FollowUpEvent(task,system,"CREATED","상담 요청 후 30초 동안 미수락",null,json.writeValueAsString(task),now));}
      catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Callback history serialization failed",e);}
    }
    q.convertedToCallback(task.getId());
  }
}
