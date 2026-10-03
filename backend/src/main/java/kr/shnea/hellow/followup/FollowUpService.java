package kr.shnea.hellow.followup;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Scheduling is CRM work. Confirmation never claims a phone call or creates an outbound dial. */
@Service
public class FollowUpService {
  private final FollowUpRepository tasks;
  private final FollowUpEventRepository events;
  private final QueueItemRepository queues;
  private final TimelineRepository timeline;
  private final WorkspaceAccess access;
  private final MembershipRepository members;
  private final OrganizationRepository organizations;
  private final RoutingLockRepository routingLock;
  private final AgentPresenceRepository presence;
  private final AssignmentAttemptRepository attempts;
  private final AuditEventRepository audits;
  private final ObjectMapper json;
  private final Clock clock;
  private final kr.shnea.hellow.transfer.WorkTransferRepository transfers;
  public FollowUpService(FollowUpRepository tasks,FollowUpEventRepository events,QueueItemRepository queues,
      TimelineRepository timeline,WorkspaceAccess access,MembershipRepository members,OrganizationRepository organizations,
      RoutingLockRepository routingLock,AgentPresenceRepository presence,AssignmentAttemptRepository attempts,
      AuditEventRepository audits,ObjectMapper json,Clock clock,kr.shnea.hellow.transfer.WorkTransferRepository transfers){
    this.tasks=tasks;this.events=events;this.queues=queues;this.timeline=timeline;this.access=access;
    this.members=members;this.organizations=organizations;this.routingLock=routingLock;
    this.presence=presence;this.attempts=attempts;this.audits=audits;this.json=json;this.clock=clock;this.transfers=transfers;
  }
  public record View(@com.fasterxml.jackson.annotation.JsonUnwrapped @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"assignedName","creatorName"}) FollowUpAction task,boolean canWrite,boolean canAssign,boolean canProcess,String contactName,String phoneNumber,String assignedName,String creatorName){}
  public record EventView(@com.fasterxml.jackson.annotation.JsonUnwrapped @com.fasterxml.jackson.annotation.JsonIgnoreProperties("actorName") FollowUpEvent event,String actorName){}
  public record Page(List<View> items,int page,boolean hasMore){}
  public record Assignee(Long memberId,String name,String teamId){}
  public record Active(boolean processing,Long id){}

  @Transactional(readOnly=true)
  public Active active(){
    var actor=access.require("followup:read");
    var running=tasks.activeForIdentity(actor.issuer(),actor.subject());
    Long id=running.stream().filter(task->actor.can("followup:read",task)).map(FollowUpAction::getId).findFirst().orElse(null);
    return new Active(!running.isEmpty(),id);
  }

  @Transactional(readOnly=true)
  public View requested(String requestId){
    var actor=access.require("followup:read");
    if(!requestId.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw bad("유효한 요청 ID를 지정해 주세요.");
    var task=tasks.findByRequestKey(requestKey(actor,requestId));
    if(task.isEmpty())return null;
    requireRead(actor,task.get());return view(task.get(),actor);
  }

  @Transactional
  public View create(FollowUpController.Request r){
    var actor=acquire();var now=clock.instant();
    String zone=r.timeZone()==null?null:zone(r.timeZone());
    if((r.proposedAt()==null)!=(zone==null))throw bad("희망 시각과 시간대를 함께 지정해 주세요.");
    String key=r.requestId()==null?null:requestKey(actor,r.requestId());
    String fingerprint=hash(Arrays.asList(r.queueCode(),r.actionType(),r.title(),r.details(),r.proposedAt(),zone));
    if(key!=null){
      var existing=tasks.findByRequestKey(key);
      if(existing.isPresent()){
        var task=existing.get();actor.requireRow(task);requireRead(actor,task);
        if(!Objects.equals(task.fingerprint(),fingerprint))throw conflict("같은 요청 ID의 내용이 다릅니다. 원래 요청을 조회해 주세요.");
        return view(task,actor);
      }
    }
    if(r.proposedAt()!=null)future(r.proposedAt(),now);
    var q=queues.lockByCode(actor.organizationId(),r.queueCode()).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    actor.requireRow(q);
    if(!actor.can("consultation:read",q))throw new ResponseStatusException(NOT_FOUND);
    if(q.getStatus()==QueueItem.QueueStatus.PROCESSING){
      if(!owned(q,actor))throw conflict("본인이 수락한 상담에서 후속 요청을 등록해 주세요.");
    }else if(q.getStatus()!=QueueItem.QueueStatus.COMPLETED)throw conflict("수락한 상담이나 완료한 상담에서 후속 요청을 등록해 주세요.");
    var task=new FollowUpAction(q.getCustomerCode(),r.actionType(),r.title(),r.details());
    task.setOrganizationId(actor.organizationId());task.setQueueCode(q.getCode());task.assignOwner(actor);
    requireRead(actor,task);
    task.initialize(actor,now,r.proposedAt(),zone,key,fingerprint);tasks.saveAndFlush(task);
    String timelineTitle="[접수·미확정] "+r.title();
    if(timelineTitle.length()>200)timelineTitle=timelineTitle.substring(0,199)+"…";
    var item=new TimelineItem(q.getCustomerCode(),TimelineItem.ChannelType.TICKET,actor.name(),timelineTitle,r.details(),false,null,"후속조치,PENDING");
    item.setOrganizationId(actor.organizationId());item.setQueueCode(q.getCode());item.copyOwner(q);timeline.save(item);
    record(task,actor,"CREATED","후속 요청 접수",null,now);return view(task,actor);
  }

  @Transactional(readOnly=true)
  public Page list(String queueCode,String customerCode,String type,String status,Instant from,Instant until,int page){
    var actor=access.require("followup:read");
    if(from!=null&&until!=null&&!from.isBefore(until))throw bad("조회 종료 시각은 시작 시각 뒤여야 합니다.");
    Specification<FollowUpAction> scope=BusinessScope.rows(actor);
    if(queueCode!=null)scope=scope.and(BusinessScope.equal("queueCode",queueCode));
    if(customerCode!=null)scope=scope.and(BusinessScope.equal("customerCode",customerCode));
    if(type!=null)scope=scope.and(BusinessScope.equal("actionType",type));
    if(status!=null)scope=scope.and(BusinessScope.equal("status",status));
    if(from!=null)scope=scope.and((root,q,cb)->cb.greaterThanOrEqualTo(root.get("scheduledAt"),from));
    if(until!=null)scope=scope.and((root,q,cb)->cb.lessThan(root.get("scheduledAt"),until));
    var result=tasks.findAll(scope,PageRequest.of(page,50,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id"))));
    return new Page(result.getContent().stream().map(task->view(task,actor)).toList(),page,result.hasNext());
  }
  @Transactional(readOnly=true)
  public View get(Long id){var actor=access.require("followup:read");return view(visible(id,actor),actor);}
  @Transactional(readOnly=true)
  public List<EventView> history(Long id,int page){
    var actor=access.require("followup:read");visible(id,actor);
    return events.findByOrganizationIdAndFollowUpIdOrderByIdDesc(actor.organizationId(),id,PageRequest.of(page,50)).stream().map(e->new EventView(e,new StaffNames(members).resolve(actor.organizationId(),e.getActorIssuer(),e.getActorSubject(),e.getActorName()))).toList();
  }
  @Transactional(readOnly=true)
  public List<Assignee> assignees(){
    var actor=access.require("followup:write");
    if(!actor.grants().containsKey("followup:read"))throw new ResponseStatusException(FORBIDDEN,"후속 업무 조회 권한이 필요합니다.");
    return members.findByOrganizationIdOrderById(actor.organizationId()).stream().filter(Membership::isActive)
      .filter(m->{var target=recipient(m);if(target==null)return false;
        var row=new FollowUpAction(null,"CALLBACK",""," ");row.setOrganizationId(actor.organizationId());row.assignOwner(target);
        return actor.issuer().equals(m.getIssuer())&&actor.subject().equals(m.getSubject())||actor.can("followup:assign",row);})
      .map(m->new Assignee(m.getId(),name(m),m.getTeamId())).toList();
  }

  @Transactional
  public View edit(Long id,FollowUpController.Edit r){
    var actor=acquire();var task=editable(id,actor,r.expectedVersion());
    mutable(task);
    if(Objects.equals(task.getTitle(),r.title())&&Objects.equals(task.getDetails(),r.details()))return view(task,actor);
    String before=snapshot(task);var now=clock.instant();
    task.edit(r.title(),r.details(),now);tasks.flush();record(task,actor,"EDITED",r.reason(),before,now);return view(task,actor);
  }
  @Transactional
  public View assign(Long id,FollowUpController.Assign r){
    var actor=acquire();var task=editable(id,actor,r.expectedVersion());mutable(task);
    if(!"CALLBACK".equals(task.getActionType()))throw bad("담당자만 지정하는 기능은 콜백에서 사용합니다.");
    if(!actor.can("followup:assign",task))throw new ResponseStatusException(FORBIDDEN,"콜백 배정 권한이 필요합니다.");
    var member=members.findById(r.assignedMemberId()).filter(m->m.isActive()&&actor.organizationId().equals(m.getOrganizationId()))
      .orElseThrow(()->bad("현재 조직의 활성 담당자를 선택해 주세요."));
    var target=recipient(member);if(target==null)throw bad("담당자의 후속 업무 조회·처리 권한이 없습니다.");
    var destination=new FollowUpAction(null,"CALLBACK","","");destination.setOrganizationId(actor.organizationId());destination.assignOwner(target);
    if(!actor.can("followup:assign",destination))throw new ResponseStatusException(FORBIDDEN,"접근 범위 안의 담당자를 선택해 주세요.");
    if("SCHEDULED".equals(task.getStatus())&&tasks.overlaps(target.issuer(),target.subject(),id,task.getScheduledAt(),task.getScheduledEndAt())>0)
      throw conflict("담당자의 다른 확정 일정과 겹칩니다. 일정을 변경해 주세요.");
    String before=snapshot(task);boolean first=task.getAssignedMemberId()==null;var now=clock.instant();
    task.assign(target,member.getId(),now);tasks.flush();record(task,actor,first?"ASSIGNED":"REASSIGNED",r.reason(),before,now);return view(task,actor);
  }
  @Transactional
  public View schedule(Long id,FollowUpController.Schedule r){
    var actor=acquire();var task=editable(id,actor,r.expectedVersion());mutable(task);
    var now=clock.instant();future(r.scheduledAt(),now);String zone=zone(r.timeZone());
    var member=members.findById(r.assignedMemberId()).filter(m->m.isActive()&&actor.organizationId().equals(m.getOrganizationId()))
      .orElseThrow(()->bad("현재 조직의 활성 담당자를 선택해 주세요."));
    var target=recipient(member);if(target==null)throw bad("담당자의 후속 업무 조회·처리 권한이 없습니다.");
    if(!owned(task,target)){
      if(!actor.can("followup:assign",task))throw new ResponseStatusException(FORBIDDEN,"담당자 재배정 권한이 필요합니다.");
      var destination=new FollowUpAction(null,task.getActionType(),task.getTitle(),task.getDetails());destination.setOrganizationId(actor.organizationId());destination.assignOwner(target);
      if(!actor.can("followup:assign",destination))throw new ResponseStatusException(FORBIDDEN,"접근 범위 안의 담당자를 선택해 주세요.");
    }
    var end=r.scheduledAt().plusSeconds(r.durationMinutes()*60L);
    if(tasks.overlaps(target.issuer(),target.subject(),id,r.scheduledAt(),end)>0)throw conflict("담당자의 다른 확정 일정과 겹칩니다. 시각이나 담당자를 변경해 주세요.");
    String before=snapshot(task);boolean reassigned=!owned(task,target);
    task.schedule(target,member.getId(),r.scheduledAt(),r.durationMinutes(),zone,now);tasks.flush();
    record(task,actor,reassigned?"REASSIGNED":"SCHEDULED",r.reason(),before,now);return view(task,actor);
  }
  @Transactional
  public View transition(Long id,FollowUpController.Transition r){
    var actor=acquire();var task=editable(id,actor,r.expectedVersion());var now=clock.instant();String state=task.getStatus();
    if("CANCELLED".equals(r.status())){
      if(Set.of("COMPLETED","CANCELLED").contains(state))throw conflict("이미 종료된 후속 업무입니다.");
      if("IN_PROGRESS".equals(state)&&!owned(task,actor)&&!actor.can("followup:assign",task))throw new ResponseStatusException(FORBIDDEN,"진행 중 업무의 취소 권한이 없습니다.");
    }else{
      if(!owned(task,actor))throw new ResponseStatusException(FORBIDDEN,"현재 담당자만 후속 업무를 처리할 수 있습니다.");
      var member=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(actor.organizationId(),actor.issuer(),actor.subject()).orElseThrow();
      if(recipient(member)==null)throw new ResponseStatusException(FORBIDDEN,"후속 업무 조회·처리 권한이 필요합니다.");
      if("IN_PROGRESS".equals(r.status())){
        if(!"SCHEDULED".equals(state)&&!("ASSIGNED".equals(state)&&"CALLBACK".equals(task.getActionType())))throw conflict("담당자가 배정된 콜백이나 확정된 일정만 시작할 수 있습니다.");
        if(task.getScheduledAt()!=null&&task.getScheduledAt().isAfter(now))throw conflict("예약 시각이 아직 되지 않았습니다.");
        if(!queues.activeForIdentity(actor.issuer(),actor.subject()).isEmpty()||!tasks.activeForIdentity(actor.issuer(),actor.subject()).isEmpty()
            ||!transfers.reservations(actor.issuer(),actor.subject()).isEmpty()
            ||presence.findByIssuerAndSubject(actor.issuer(),actor.subject()).flatMap(p->attempts.activeForPresence(p.getId())).isPresent())
          throw conflict("수신 요청·상담·후처리 또는 다른 후속 업무를 먼저 완료해 주세요.");
      }else if(!"IN_PROGRESS".equals(state))throw conflict("진행 중 업무만 완료하거나 실패로 기록할 수 있습니다.");
    }
    String before=snapshot(task);task.transition(r.status(),r.reason(),now);tasks.flush();
    // Synchronize the busy marker under the same global lock as incoming routing.
    presence.findByIssuerAndSubject(task.getOwnerIssuer(),task.getOwnerSubject()).ifPresent(p->{
      if("IN_PROGRESS".equals(task.getStatus()))p.beginFollowUp(task.getOrganizationId(),task.getId(),now);
      else p.observeFollowUp(null,now);
    });
    record(task,actor,r.status(),r.reason(),before,now);return view(task,actor);
  }

  private WorkspaceAccess.Actor acquire(){
    access.identity();String org=access.organizationId();
    routingLock.acquire().orElseThrow(()->new IllegalStateException("Routing lock missing"));
    organizations.lockById(org).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    return access.require("followup:write");
  }
  private FollowUpAction visible(Long id,WorkspaceAccess.Actor actor){
    return tasks.findOne(BusinessScope.<FollowUpAction>rows(actor).and(BusinessScope.equal("id",id)))
      .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"접근할 수 있는 후속 업무가 없습니다."));
  }
  private FollowUpAction editable(Long id,WorkspaceAccess.Actor actor,long version){
    var task=tasks.lockById(actor.organizationId(),id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    actor.requireRow(task);requireRead(actor,task);
    if(!Objects.equals(task.getVersion(),version))throw conflict("다른 창에서 후속 업무를 변경했습니다. 입력을 유지한 채 최신 상태를 다시 확인해 주세요.");
    return task;
  }
  private void mutable(FollowUpAction task){if(!Set.of("PENDING","ASSIGNED","SCHEDULED","FAILED").contains(task.getStatus()))throw conflict("미확정·배정·확정·실패 업무만 수정하거나 재예약할 수 있습니다.");}
  private void requireRead(WorkspaceAccess.Actor actor,FollowUpAction task){if(!actor.can("followup:read",task))throw new ResponseStatusException(NOT_FOUND,"접근할 수 있는 후속 업무가 없습니다.");}
  private WorkspaceAccess.Actor recipient(Membership m){
    if(!m.isActive())return null;var grants=access.authority().grants(m);
    if(!grants.containsKey("followup:read")||!grants.containsKey("followup:write"))return null;
    return new WorkspaceAccess.Actor(m.getOrganizationId(),m.getSubject(),name(m),m.getIssuer(),m.getTeamId(),grants.get("followup:write"),access.authority().teamScope(m),grants);
  }
  private View view(FollowUpAction task,WorkspaceAccess.Actor actor){
    boolean write=actor.can("followup:read",task)&&actor.can("followup:write",task);
    var source=task.getQueueCode()==null?null:queues.findByOrganizationIdAndCode(task.getOrganizationId(),task.getQueueCode()).orElse(null);
    return new View(task,write,write&&actor.can("followup:assign",task),write&&owned(task,actor),source==null?null:source.getCustomerName(),source==null?null:source.getPhoneNumber(),task.getAssignedMemberId()==null?null:new StaffNames(members).resolve(actor.organizationId(),task.getOwnerIssuer(),task.getOwnerSubject(),task.getAssignedName()),new StaffNames(members).resolve(actor.organizationId(),task.getCreatorIssuer(),task.getCreatorSubject(),task.getCreatorName()));
  }
  private String requestKey(WorkspaceAccess.Actor actor,String requestId){
    return UUID.nameUUIDFromBytes((actor.organizationId()+"\n"+actor.issuer()+"\n"+actor.subject()+"\n"+requestId.toLowerCase(Locale.ROOT)).getBytes(StandardCharsets.UTF_8)).toString();
  }
  private String name(Membership m){return StaffNames.display(m.getDisplayName(),m.getLoginId());}
  private boolean owned(OrganizationOwned task,WorkspaceAccess.Actor actor){return Objects.equals(task.getOwnerIssuer(),actor.issuer())&&Objects.equals(task.getOwnerSubject(),actor.subject());}
  private String zone(String value){if(!ZoneId.getAvailableZoneIds().contains(value))throw bad("유효한 IANA 시간대를 지정해 주세요.");return ZoneId.of(value).getId();}
  private void future(Instant value,Instant now){if(!value.isAfter(now)||value.isAfter(now.plus(3650,java.time.temporal.ChronoUnit.DAYS)))throw bad("현재 이후 10년 이내의 시각을 지정해 주세요.");}
  private String snapshot(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException("Follow-up serialization failed",e);}}
  private String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(snapshot(value).getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
  private void record(FollowUpAction task,WorkspaceAccess.Actor actor,String action,String reason,String before,Instant now){
    events.save(new FollowUpEvent(task,actor,action,reason,before,snapshot(task),now));
    audits.save(new AuditEvent(actor.organizationId(),actor.issuer(),actor.subject(),"followup."+action.toLowerCase(Locale.ROOT),task.getId().toString(),"후속 업무 상태 "+task.getStatus()));
  }
  private ResponseStatusException bad(String message){return new ResponseStatusException(BAD_REQUEST,message);}
  private ResponseStatusException conflict(String message){return new ResponseStatusException(CONFLICT,message);}
}
