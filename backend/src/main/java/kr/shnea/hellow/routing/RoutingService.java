package kr.shnea.hellow.routing;

import static kr.shnea.hellow.routing.AssignmentAttempt.Outcome.*;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

import java.time.*;
import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.followup.FollowUpRepository;
import kr.shnea.hellow.transfer.WorkTransferRepository;
import kr.shnea.hellow.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Durable LONGEST_IDLE routing. The database lock covers identities across all organizations. */
@Service
public class RoutingService {
  public static final int MAX_ATTEMPTS=10;
  private final RoutingLockRepository lock;
  private final AgentPresenceRepository presence;
  private final AssignmentAttemptRepository attempts;
  private final QueueItemRepository queues;
  private final OrganizationRepository organizations;
  private final MembershipRepository members;
  private final MembershipAccess authority;
  private final Clock clock;
  private final AuditEventRepository audits;
  private final FollowUpRepository followups;
  private final WorkTransferRepository transfers;
  public RoutingService(RoutingLockRepository lock,AgentPresenceRepository presence,AssignmentAttemptRepository attempts,
      QueueItemRepository queues,OrganizationRepository organizations,MembershipRepository members,MembershipAccess authority,Clock clock,AuditEventRepository audits,FollowUpRepository followups,WorkTransferRepository transfers){
    this.lock=lock;this.presence=presence;this.attempts=attempts;this.queues=queues;
    this.organizations=organizations;this.members=members;this.authority=authority;this.clock=clock;this.audits=audits;this.followups=followups;this.transfers=transfers;
  }

  public record AgentView(String state,AgentPresence.Availability availability,long version,
      String activeOrganizationId,Instant heartbeatExpiresAt,Instant availableSince,
      String queueCode,String attemptId,Instant offerExpiresAt,Long followUpId,String workTransferId){}
  public record OfferView(String id,String subject,String name,Instant expiresAt,boolean received){}
  public record QueueView(@com.fasterxml.jackson.annotation.JsonUnwrapped QueueItem item,OfferView offer,boolean canAccept,boolean routingPaused,int attemptCount){}
  public record AttemptView(String id,String agentSubject,String agentName,Instant offeredAt,
      Instant expiresAt,Instant receivedAt,Instant finishedAt,AssignmentAttempt.Outcome outcome,int routingCycle){}

  @Transactional
  public AgentView heartbeat(WorkspaceAccess.Actor original,String receivedAttemptId){
    return heartbeat(original,receivedAttemptId,null);
  }

  @Transactional
  public AgentView heartbeat(WorkspaceAccess.Actor original,String receivedAttemptId,Boolean mediaReady){
    acquire(original.organizationId());var actor=authorize(original);var now=clock.instant();
    var p=getOrCreate(actor,now);
    if(!p.getOrganizationId().equals(actor.organizationId()))
      throw conflict("다른 조직에서 상담 상태를 사용 중입니다. 현재 조직으로 상태를 전환해 주세요.");
    p.heartbeat(actor.name(),now);
    if(Boolean.FALSE.equals(mediaReady)&&p.getAvailability()==AgentPresence.Availability.AVAILABLE){
      attempts.activeForPresence(p.getId()).ifPresent(a->{
        queues.lockByCode(a.getOrganizationId(),a.getQueueCode());finish(a,p,OFFLINE,now);
      });
      attempts.flush();
      p.change(actor.organizationId(),AgentPresence.Availability.AWAY,now);
      audit(actor,"agent.media.unavailable",p.getId(),"AWAY");
    }
    if(receivedAttemptId!=null)attempts.findById(receivedAttemptId)
      .filter(a->a.active()&&a.getPresenceId().equals(p.getId())&&a.getOrganizationId().equals(actor.organizationId())&&a.getExpiresAt().isAfter(now))
      .ifPresent(a->a.received(now));
    routeLocked(actor.organizationId(),now);
    return view(p,actor.organizationId(),now);
  }

  @Transactional(readOnly=true)
  public AgentView current(WorkspaceAccess.Actor actor){
    var p=presence.findByIssuerAndSubject(actor.issuer(),actor.subject());
    return p.map(row->view(row,actor.organizationId(),clock.instant())).orElseGet(()->
      withoutPresence(actor));
  }

  @Transactional
  public AgentView change(WorkspaceAccess.Actor original,AgentPresence.Availability state,long expectedVersion){
    acquire(original.organizationId());var actor=authorize(original);var now=clock.instant();var p=getOrCreate(actor,now);
    if(p.getStateRevision()!=expectedVersion)throw conflict("다른 창에서 상담 상태를 변경했습니다. 현재 상태를 확인한 뒤 다시 선택해 주세요.");
    var work=work(p);
    if(busy(p)&&(!p.getOrganizationId().equals(actor.organizationId())||work.stream().anyMatch(q->!q.getOrganizationId().equals(actor.organizationId()))
        ||followups.activeForIdentity(p.getIssuer(),p.getSubject()).stream().anyMatch(f->!f.getOrganizationId().equals(actor.organizationId()))||state==AgentPresence.Availability.AVAILABLE))
      throw conflict("진행 중인 상담과 후처리를 완료한 뒤 대기 또는 조직 변경이 가능합니다.");
    // Changing organization or choosing away/offline gives up a reservation, but never an accepted interaction.
    var offered=attempts.activeForPresence(p.getId());
    if(offered.isPresent()&&(!p.getOrganizationId().equals(actor.organizationId())||state!=AgentPresence.Availability.AVAILABLE)){
      var a=offered.get();queues.lockByCode(a.getOrganizationId(),a.getQueueCode());
      finish(a,p,p.getOrganizationId().equals(actor.organizationId())?OFFLINE:ORGANIZATION_CHANGED,now);
      attempts.flush();
    }
    p.change(actor.organizationId(),state,now);p.heartbeat(actor.name(),now);
    audit(actor,"agent.state.change",p.getId(),state.name());
    routeLocked(actor.organizationId(),now);
    return view(p,actor.organizationId(),now);
  }

  @Transactional
  public QueueItem accept(WorkspaceAccess.Actor original,String code,String attemptId){
    acquire(original.organizationId());var actor=authorize(original);var now=clock.instant();
    var q=queue(actor.organizationId(),code);
    if(q.getStatus()==QueueItem.QueueStatus.PROCESSING&&owned(q,actor))return q;
    if(q.getStatus()!=QueueItem.QueueStatus.WAITING)throw conflict("이미 처리 중이거나 종료된 요청입니다.");
    if(!eligibleQueue(actor,q))throw new ResponseStatusException(NOT_FOUND);
    var p=presence.findByIssuerAndSubject(actor.issuer(),actor.subject()).orElseThrow(()->conflict("상담 상태를 대기로 변경해 주세요."));
    if(!p.getOrganizationId().equals(actor.organizationId())||!p.live(now)||p.getAvailability()!=AgentPresence.Availability.AVAILABLE||busy(p))
      throw conflict("대기 상태에서만 수락할 수 있습니다. 진행 중인 상담과 후처리를 먼저 완료해 주세요.");
    var offer=attempts.activeForQueue(actor.organizationId(),code);
    AssignmentAttempt a;
    if(offer.isPresent()){
      a=offer.get();
      if(!a.belongsTo(actor.issuer(),actor.subject())||attemptId==null||!attemptId.equals(a.getId())||!a.getExpiresAt().isAfter(now))
        throw conflict("본인에게 배정된 유효한 수신 요청만 수락할 수 있습니다.");
    }else{
      // Explicit pickup of an unreserved backlog uses the same availability and identity lock as ACD.
      if(attemptId!=null||attempts.activeForPresence(p.getId()).isPresent())throw conflict("수신 배정이 변경되었습니다. 현재 배정을 확인해 주세요.");
      if(history(q).size()>=MAX_ATTEMPTS)throw conflict("배정 시도 한도에 도달했습니다. 배정을 다시 시작해 주세요.");
      a=attempts.save(new AssignmentAttempt(q.getOrganizationId(),code,q.getRoutingCycle(),p,now));
    }
    a.received(now);a.finish(ACCEPTED,now);
    q.acceptBy(actor.subject(),actor.name());q.assignOwner(actor);p.observeWork(code,now);
    return queues.save(q);
  }

  @Transactional
  public AgentView reject(WorkspaceAccess.Actor original,String code,String attemptId){
    acquire(original.organizationId());var actor=authorize(original);var now=clock.instant();var q=queue(actor.organizationId(),code);
    var a=attempts.findById(attemptId).filter(row->row.getOrganizationId().equals(actor.organizationId())&&row.getQueueCode().equals(code)&&row.belongsTo(actor.issuer(),actor.subject()))
      .orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    var p=presence.findById(a.getPresenceId()).orElseThrow();
    if(a.getOutcome()==REJECTED)return view(p,actor.organizationId(),now);
    if(!a.active()||!a.getExpiresAt().isAfter(now)||q.getStatus()!=QueueItem.QueueStatus.WAITING)throw conflict("이미 만료되거나 처리된 배정입니다.");
    finish(a,p,REJECTED,now);attempts.flush();
    routeLocked(actor.organizationId(),now);
    return view(p,actor.organizationId(),now);
  }

  @Transactional
  public void restart(WorkspaceAccess.Actor original,String code,long expectedVersion){
    acquire(original.organizationId());var actor=authorize(original);var now=clock.instant();var q=queue(actor.organizationId(),code);
    if(!eligibleQueue(actor,q))throw new ResponseStatusException(NOT_FOUND);
    if(q.getStatus()!=QueueItem.QueueStatus.WAITING||attempts.activeForQueue(actor.organizationId(),code).isPresent())throw conflict("수신 또는 처리 중인 요청은 배정을 다시 시작할 수 없습니다.");
    if(q.getVersion()!=expectedVersion)throw conflict("접수 상태가 변경되었습니다. 다시 조회해 주세요.");
    q.restartRouting();queues.saveAndFlush(q);
    audit(actor,"queue.routing.restart",code,"배정 회차 "+q.getRoutingCycle());
    routeLocked(actor.organizationId(),now);
  }

  @Transactional
  public void route(String organizationId){acquire(organizationId);routeLocked(organizationId,clock.instant());}

  @Transactional
  public void logout(String issuer,String subject){
    lock.acquire().orElseThrow(()->new IllegalStateException("Routing lock missing"));
    presence.findByIssuerAndSubject(issuer,subject).ifPresent(p->{
      var now=clock.instant();attempts.activeForPresence(p.getId()).ifPresent(a->{
        queues.lockByCode(a.getOrganizationId(),a.getQueueCode());finish(a,p,OFFLINE,now);
      });
      p.change(p.getOrganizationId(),AgentPresence.Availability.OFFLINE,now);
    });
  }

  private void routeLocked(String org,Instant now){
    reconcile(org,now);attempts.flush();
    if(!organizations.findById(org).map(Organization::isActive).orElse(false))return;
    var agents=presence.findByOrganizationId(org);
    for(var p:agents){var jobs=work(p);var followUp=followups.activeForIdentity(p.getIssuer(),p.getSubject());var reserved=transfers.reservations(p.getIssuer(),p.getSubject());
      p.observeWork(!jobs.isEmpty()?jobs.getFirst().getCode():!followUp.isEmpty()?"followup-"+followUp.getFirst().getId():reserved.isEmpty()?null:"transfer-"+reserved.getFirst().getId(),now);}
    agents.sort(Comparator.comparing(AgentPresence::getAvailableSince).thenComparing(AgentPresence::getId));
    var waiting=queues.findByOrganizationIdAndStatusOrderByCreatedAtAsc(org,QueueItem.QueueStatus.WAITING);
    waiting.sort(Comparator.comparingInt((QueueItem q)->"urgent".equals(q.getPriority())?0:"low".equals(q.getPriority())?2:1).thenComparing(QueueItem::getCreatedAt).thenComparing(QueueItem::getCode));
    for(var candidate:waiting){
      if(candidate.getType()==QueueItem.ItemType.CALLBACK)continue; // Scheduling decides when callback work becomes due.
      var q=queue(org,candidate.getCode());
      if(q.supportExpired(now)){q.cancel();continue;}
      if(q.getStatus()!=QueueItem.QueueStatus.WAITING||attempts.activeForQueue(org,q.getCode()).isPresent())continue;
      var previous=history(q);if(previous.size()>=MAX_ATTEMPTS)continue;
      var tried=new HashSet<String>();previous.forEach(a->tried.add(a.getPresenceId()));
      for(var p:agents){
        if(!p.live(now)||p.getAvailability()!=AgentPresence.Availability.AVAILABLE||tried.contains(p.getId())||busy(p)||attempts.activeForPresence(p.getId()).isPresent())continue;
        var actor=agentActor(p);if(actor.isEmpty()||!eligibleQueue(actor.get(),q))continue;
        attempts.saveAndFlush(new AssignmentAttempt(org,q.getCode(),q.getRoutingCycle(),p,now));
        break;
      }
    }
  }

  private void reconcile(String org,Instant now){
    for(var a:attempts.activeInOrganization(org)){
      var q=queues.lockByCode(org,a.getQueueCode());var p=presence.findById(a.getPresenceId()).orElseThrow();
      if(q.isPresent()&&q.get().getStatus()==QueueItem.QueueStatus.WAITING&&q.get().supportExpired(now))q.get().cancel();
      if(q.isEmpty()||q.get().getStatus()!=QueueItem.QueueStatus.WAITING){finish(a,p,CANCELLED,now);continue;}
      if(!p.getOrganizationId().equals(org)){finish(a,p,ORGANIZATION_CHANGED,now);continue;}
      var actor=agentActor(p);
      if(!organizations.findById(org).map(Organization::isActive).orElse(false)||actor.isEmpty()||!eligibleQueue(actor.get(),q.get())){finish(a,p,REVOKED,now);continue;}
      if(!p.live(now)||p.getAvailability()!=AgentPresence.Availability.AVAILABLE){finish(a,p,OFFLINE,now);continue;}
      if(!a.getExpiresAt().isAfter(now)){
        finish(a,p,a.getReceivedAt()==null?MISSED:TIMED_OUT,now);p.missed(now);
      }
    }
  }

  private void finish(AssignmentAttempt a,AgentPresence p,AssignmentAttempt.Outcome result,Instant now){a.finish(result,now);p.released(now);}
  private void audit(WorkspaceAccess.Actor actor,String action,String target,String details){audits.save(new AuditEvent(actor.organizationId(),actor.issuer(),actor.subject(),action,target,details));}
  private List<AssignmentAttempt> history(QueueItem q){return attempts.findByOrganizationIdAndQueueCodeAndRoutingCycle(q.getOrganizationId(),q.getCode(),q.getRoutingCycle());}
  private boolean busy(AgentPresence p){return !work(p).isEmpty()||!followups.activeForIdentity(p.getIssuer(),p.getSubject()).isEmpty()||!transfers.reservations(p.getIssuer(),p.getSubject()).isEmpty();}
  private List<QueueItem> work(AgentPresence p){return queues.activeForIdentity(p.getIssuer(),p.getSubject());}
  private AgentPresence getOrCreate(WorkspaceAccess.Actor actor,Instant now){return presence.findByIssuerAndSubject(actor.issuer(),actor.subject()).orElseGet(()->presence.saveAndFlush(new AgentPresence(actor.issuer(),actor.subject(),actor.organizationId(),actor.name(),now)));}
  private WorkspaceAccess.Actor authorize(WorkspaceAccess.Actor original){
    var member=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(original.organizationId(),original.issuer(),original.subject()).orElseThrow(()->new ResponseStatusException(FORBIDDEN));
    var grants=authority.grants(member);
    if(!organizations.findById(original.organizationId()).map(Organization::isActive).orElse(false)||!grants.containsKey("queue:accept")||!grants.containsKey("queue:read"))throw new ResponseStatusException(FORBIDDEN);
    return actor(member,original.name(),grants);
  }
  private Optional<WorkspaceAccess.Actor> agentActor(AgentPresence p){return members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(p.getOrganizationId(),p.getIssuer(),p.getSubject()).flatMap(m->{
    var grants=authority.grants(m);return grants.containsKey("queue:accept")&&grants.containsKey("queue:read")?Optional.of(actor(m,p.getDisplayName(),grants)):Optional.empty();});}
  private WorkspaceAccess.Actor actor(Membership m,String name,Map<String,DataScope> grants){return new WorkspaceAccess.Actor(m.getOrganizationId(),m.getSubject(),name,m.getIssuer(),m.getTeamId(),grants.get("queue:accept"),authority.teamScope(m),grants);}
  private boolean eligibleQueue(WorkspaceAccess.Actor actor,QueueItem q){return !q.supportExpired(clock.instant())&&actor.organizationId().equals(q.getOrganizationId())&&(q.getOwnerSubject()==null||actor.can("queue:accept",q)&&actor.can("queue:read",q));}
  private boolean owned(QueueItem q,WorkspaceAccess.Actor actor){return Objects.equals(q.getOwnerIssuer(),actor.issuer())&&Objects.equals(q.getAssignedSubject(),actor.subject());}
  private QueueItem queue(String org,String code){return queues.lockByCode(org,code).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private void acquire(String org){lock.acquire().orElseThrow(()->new IllegalStateException("Routing lock missing"));organizations.lockById(org).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private ResponseStatusException conflict(String message){return new ResponseStatusException(CONFLICT,message);}

  private AgentView view(AgentPresence p,String org,Instant now){
    var jobs=work(p);var offer=attempts.activeForPresence(p.getId()).filter(a->a.getExpiresAt().isAfter(now));
    var reserved=transfers.reservations(p.getIssuer(),p.getSubject());
    String state;
    String code=null;
    if(!jobs.isEmpty()){
      var q=jobs.getFirst();state=q.getType()==QueueItem.ItemType.CALL&&q.isCallEnded()?"AFTER_CALL":"CALLING";
      if(org.equals(q.getOrganizationId()))code=q.getCode();
    }else if(!followups.activeForIdentity(p.getIssuer(),p.getSubject()).isEmpty()){state="FOLLOW_UP";}
    else if(!reserved.isEmpty()){state="TRANSFER_PENDING";}
    else if(offer.isPresent()&&p.live(now)&&p.getAvailability()==AgentPresence.Availability.AVAILABLE){state=offer.get().getReceivedAt()==null?"RESERVED":"RINGING";}
    else state=p.live(now)?p.getAvailability().name():"OFFLINE";
    var visible=offer.filter(a->org.equals(a.getOrganizationId()));
    return new AgentView(state,p.getAvailability(),p.getStateRevision(),p.getOrganizationId(),p.getHeartbeatAt()==null?null:p.getHeartbeatAt().plusSeconds(45),p.getAvailableSince(),
      code==null?visible.map(AssignmentAttempt::getQueueCode).orElse(null):code,visible.map(AssignmentAttempt::getId).orElse(null),visible.map(AssignmentAttempt::getExpiresAt).orElse(null),
      followups.activeForIdentity(p.getIssuer(),p.getSubject()).stream().filter(f->org.equals(f.getOrganizationId())).map(f->f.getId()).findFirst().orElse(null),reserved.stream().filter(t->org.equals(t.getOrganizationId())).map(t->t.getId()).findFirst().orElse(null));
  }

  private AgentView withoutPresence(WorkspaceAccess.Actor actor){
    var work=followups.activeForIdentity(actor.issuer(),actor.subject());
    return new AgentView(work.isEmpty()?"OFFLINE":"FOLLOW_UP",AgentPresence.Availability.OFFLINE,0,actor.organizationId(),null,null,null,null,null,
      work.stream().filter(f->actor.organizationId().equals(f.getOrganizationId())).map(f->f.getId()).findFirst().orElse(null),null);
  }

  @Transactional(readOnly=true)
  public List<QueueView> decorate(List<QueueItem> rows,WorkspaceAccess.Actor actor){
    var p=presence.findByIssuerAndSubject(actor.issuer(),actor.subject());var now=clock.instant();
    boolean ready=p.filter(row->row.getOrganizationId().equals(actor.organizationId())&&row.live(now)&&row.getAvailability()==AgentPresence.Availability.AVAILABLE&&!busy(row)).isPresent();
    var ownOffer=p.flatMap(row->attempts.activeForPresence(row.getId()));
    var grants=actor.grants();
    return rows.stream().map(q->{
      var a=attempts.activeForQueue(actor.organizationId(),q.getCode());
      var offer=a.map(row->new OfferView(row.getId(),row.getAgentSubject(),row.getAgentName(),row.getExpiresAt(),row.getReceivedAt()!=null)).orElse(null);
      var count=history(q).size();
      boolean can=grants.containsKey("queue:accept")&&ready&&q.getStatus()==QueueItem.QueueStatus.WAITING&&eligibleQueue(actor,q)&&
        (a.isPresent()?a.get().belongsTo(actor.issuer(),actor.subject())&&a.get().getExpiresAt().isAfter(now):ownOffer.isEmpty()&&count<MAX_ATTEMPTS);
      return new QueueView(q,offer,can,a.isEmpty()&&count>=MAX_ATTEMPTS,count);
    }).toList();
  }

  @Transactional(readOnly=true)
  public List<AttemptView> history(WorkspaceAccess.Actor actor,String code){
    var q=queues.findByOrganizationIdAndCode(actor.organizationId(),code).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    actor.requireRow(q);
    return attempts.findTop100ByOrganizationIdAndQueueCodeOrderByOfferedAtDesc(actor.organizationId(),code).stream()
      .map(a->new AttemptView(a.getId(),a.getAgentSubject(),a.getAgentName(),a.getOfferedAt(),a.getExpiresAt(),a.getReceivedAt(),a.getFinishedAt(),a.getOutcome(),a.getRoutingCycle())).toList();
  }
}
