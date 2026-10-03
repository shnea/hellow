package kr.shnea.hellow.transfer;

import static org.springframework.http.HttpStatus.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.followup.FollowUpRepository;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.security.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Locks protect current authority and source ownership. Provider operations are never CRM acceptance. */
@Service
public class WorkTransferService {
  @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
  private final WorkTransferRepository transfers;private final WorkTransferEventRepository events;
  private final ConsultationRepository records;private final QueueItemRepository queues;
  private final WorkspaceAccess access;private final MembershipRepository members;private final MembershipAccess authority;
  private final OrganizationRepository organizations;private final RoutingLockRepository lock;
  private final AgentPresenceRepository presence;private final AssignmentAttemptRepository attempts;private final FollowUpRepository followups;
  private final AuditEventRepository audits;private final ObjectMapper json;private final Clock clock;
  private final kr.shnea.hellow.livekit.LiveKitService media;
  public static final List<WorkTransfer.Status> PENDING=List.of(WorkTransfer.Status.OFFERED,WorkTransfer.Status.CONNECTING);
  public WorkTransferService(WorkTransferRepository transfers,WorkTransferEventRepository events,ConsultationRepository records,
      QueueItemRepository queues,WorkspaceAccess access,MembershipRepository members,MembershipAccess authority,
      OrganizationRepository organizations,RoutingLockRepository lock,AgentPresenceRepository presence,
      AssignmentAttemptRepository attempts,FollowUpRepository followups,AuditEventRepository audits,ObjectMapper json,Clock clock,kr.shnea.hellow.livekit.LiveKitService media){
    this.transfers=transfers;this.events=events;this.records=records;this.queues=queues;this.access=access;this.members=members;this.authority=authority;
    this.organizations=organizations;this.lock=lock;this.presence=presence;this.attempts=attempts;this.followups=followups;this.audits=audits;this.json=json;this.clock=clock;this.media=media;
  }
  public record View(@com.fasterxml.jackson.annotation.JsonUnwrapped WorkTransfer transfer,boolean canAccept,boolean canReject,boolean canCancel,boolean canReadRecord){}
  public record Page(List<View> items,int page,boolean hasMore){}
  public enum Direction {ALL,SENT,RECEIVED}
  public record Assignee(Long memberId,String name,String teamId){}
  private record Invalid(WorkTransfer.Status status,String reason){}
  @Transactional public View create(WorkTransferController.Request r){return create(r,WorkTransfer.Kind.WORK);}
  @Transactional public View createCall(WorkTransferController.Request r){return create(r,WorkTransfer.Kind.CALL);}
  private View create(WorkTransferController.Request r,WorkTransfer.Kind kind){
    String org=access.organizationId();acquire(org);var actor=access.require("consultation:transfer");reconcileLocked(org);
    if(!actor.grants().containsKey("transfer:read"))throw forbidden();
    String reason=r.reason().trim();if(reason.isEmpty())throw bad("이관 사유를 입력해 주세요.");
    // Existing WORK requests retain their V14 fingerprint so pending client retries survive migration.
    String key=key(actor,r.requestId());String fingerprint=hash(kind==WorkTransfer.Kind.WORK
      ?Arrays.asList(r.consultationId(),r.expectedRecordVersion(),r.toMemberId(),reason,r.memo())
      :Arrays.asList(kind,r.consultationId(),r.expectedRecordVersion(),r.toMemberId(),reason,r.memo()));
    var prior=transfers.findByRequestKey(key);
    if(prior.isPresent()){
      var t=read(actor.forPermission("transfer:read").orElseThrow(),prior.get().getId());
      if(t.getKind()!=kind||!Objects.equals(t.fingerprint(),fingerprint))throw conflict("같은 요청 ID의 이관 내용이 다릅니다. 원래 요청을 확인해 주세요.");
      return view(t,actor);
    }
    var record=lockedRecord(org,r.consultationId());requireSender(actor,record);
    if(!Objects.equals(record.getVersion(),r.expectedRecordVersion()))throw conflict("상담이 변경되었습니다. 입력을 보존하고 최신 기록을 확인해 주세요.");
    var q=sourceQueue(record,kind==WorkTransfer.Kind.CALL);boolean live=q!=null&&q.getStatus()==QueueItem.QueueStatus.PROCESSING;
    if(kind==WorkTransfer.Kind.CALL&&(q==null||!live||q.getType()!=QueueItem.ItemType.CALL||q.isCallEnded()))throw conflict("활성 음성 통화만 통화 이관할 수 있습니다.");
    if(kind==WorkTransfer.Kind.CALL&&(!same(actor,record.getOwnerIssuer(),record.getOwnerSubject())||!actor.can("queue:accept",q)||!actor.can("queue:read",q)))throw forbidden();
    var from=members.findByOrganizationIdAndIssuerAndSubject(org,record.getOwnerIssuer(),record.getOwnerSubject()).orElseThrow(()->conflict("기존 담당자가 확인되지 않습니다."));
    var to=members.findById(r.toMemberId()).filter(m->org.equals(m.getOrganizationId())&&m.isActive()).orElseThrow(()->bad("같은 조직의 활성 직원을 선택해 주세요."));
    if(Objects.equals(from.getIssuer(),to.getIssuer())&&Objects.equals(from.getSubject(),to.getSubject()))throw bad("현재 담당자와 다른 직원을 선택해 주세요.");
    if(!eligible(to,record,live,null))throw conflict("대상 직원의 현재 권한 또는 수신 상태로는 이관할 수 없습니다.");
    if(transfers.existsByOrganizationIdAndConsultationIdAndStatusIn(org,record.getId(),PENDING))throw conflict("이미 수락을 기다리는 이관 요청이 있습니다.");
    var now=clock.instant();var proposal=new WorkTransfer(record,from,to,actor,reason,r.memo(),key,fingerprint,now,now.plusSeconds(live?30:600),live);
    if(q!=null)proposal.snapshotMedia(q);
    if(kind==WorkTransfer.Kind.CALL)proposal.call(q);
    var t=transfers.saveAndFlush(proposal);
    event(t,actor,"OFFERED",reason);return view(t,actor);
  }
  @Transactional public View command(String id,WorkTransferController.Command command,WorkTransfer.Status next){
    String org=access.organizationId();acquire(org);var actor=access.require("transfer:read");var t=read(actor,id);lockedRecord(org,t.getConsultationId());
    boolean recipient=recipient(t,actor);boolean cancel=mayCancel(t,actor);
    if(next==WorkTransfer.Status.CANCELLED?!cancel:!recipient)throw forbidden();
    // Repeat delivery of a successful actor command cannot change the recorded result.
    if(t.getStatus()==next)return view(t,actor);
    if(next==WorkTransfer.Status.ACCEPTED&&t.getKind()==WorkTransfer.Kind.CALL&&t.getStatus()==WorkTransfer.Status.CONNECTING)return view(t,actor);
    if(!t.pending())throw conflict("이미 처리된 이관 요청입니다.");
    if(!Objects.equals(t.getVersion(),command.expectedVersion()))throw conflict("이관 상태가 변경되었습니다. 입력을 유지하고 다시 조회해 주세요.");
    String reason=command.reason().trim();if(reason.isEmpty())throw bad("처리 사유를 입력해 주세요.");
    var invalid=invalid(t);
    if(invalid!=null){finish(t,systemActor(org),invalid.status(),invalid.reason());return view(t,actor);}
    if(next==WorkTransfer.Status.ACCEPTED){
      if(t.getKind()==WorkTransfer.Kind.CALL){t.connecting(reason,clock.instant());transfers.saveAndFlush(t);event(t,actor,"CONNECTING",reason);return view(t,actor);}
      var record=record(org,t.getConsultationId());var to=members.findById(t.getToMemberId()).orElseThrow();var target=actor(to);
      var q=sourceQueue(record);
      record.handoff(target);records.saveAndFlush(record);
      if(t.isLiveWork()){
        q.handoff(target);queues.saveAndFlush(q);
        presence.findByIssuerAndSubject(target.issuer(),target.subject()).orElseThrow().beginWork(org,q.getCode(),clock.instant());
      }
    }
    finish(t,actor,next,reason);return view(t,actor);
  }
  @Transactional(readOnly=true) public View get(String id){var actor=access.require("transfer:read");return view(read(actor,id),actor);}
  @Transactional(readOnly=true) public View requested(String uuid){
    var actor=access.require("transfer:read");var t=transfers.findByRequestKey(key(actor,uuid));return t.map(row->view(read(actor,row.getId()),actor)).orElse(null);
  }
  @Transactional(readOnly=true) public Page list(int page,WorkTransfer.Status state,Direction direction){
    page(page);var actor=access.require("transfer:read");var scope=scope(actor);if(state!=null)scope=scope.and(BusinessScope.equal("status",state));
    // Filter before pagination, with both issuer and subject. Team/organization readers retain ALL.
    if(direction!=Direction.ALL) {
      String prefix=direction==Direction.RECEIVED?"to":"requester";
      scope=scope.and(BusinessScope.equal(prefix+"Issuer",actor.issuer())).and(BusinessScope.equal(prefix+"Subject",actor.subject()));
    }
    var result=transfers.findAll(scope,PageRequest.of(page,50,Sort.by(Sort.Direction.DESC,"requestedAt").and(Sort.by("id"))));
    return new Page(result.getContent().stream().map(t->view(t,actor)).toList(),page,result.hasNext());
  }
  @Transactional(readOnly=true) public List<WorkTransferEvent> history(String id,int page){
    page(page);var actor=access.require("transfer:read");read(actor,id);return events.findByOrganizationIdAndTransferIdOrderByIdDesc(actor.organizationId(),id,PageRequest.of(page,50));
  }
  @Transactional(readOnly=true) public List<Assignee> assignees(Long recordId){
    return assignees(recordId,false);
  }
  @Transactional(readOnly=true) public List<Assignee> callAssignees(Long recordId){return assignees(recordId,true);}
  private List<Assignee> assignees(Long recordId,boolean call){
    var actor=access.require("consultation:transfer");var record=record(actor.organizationId(),recordId);requireSender(actor,record);var q=sourceQueue(record,call);
    if(call&&(q==null||q.getStatus()!=QueueItem.QueueStatus.PROCESSING||q.getType()!=QueueItem.ItemType.CALL||q.isCallEnded()||!same(actor,record.getOwnerIssuer(),record.getOwnerSubject())||!actor.can("queue:accept",q)||!actor.can("queue:read",q)))throw conflict("본인이 처리 중인 활성 통화에서 이관해 주세요.");
    boolean live=q!=null&&q.getStatus()==QueueItem.QueueStatus.PROCESSING;
    return members.findByOrganizationIdOrderById(actor.organizationId()).stream().filter(m->m.isActive()&&!same(m,record.getOwnerIssuer(),record.getOwnerSubject())&&eligible(m,record,live,null))
      .map(m->new Assignee(m.getId(),name(m),m.getTeamId())).toList();
  }
  @Transactional public void reconcile(String org){acquire(org);reconcileLocked(org);}
  public record CallMediaResponse(View transfer,kr.shnea.hellow.livekit.LiveKitService.LiveKitTokenResponse media){}
  @Transactional public CallMediaResponse callToken(String id,long expectedVersion){
    String org=access.organizationId();acquire(org);var actor=access.require("transfer:read");var t=read(actor,id);lockedRecord(org,t.getConsultationId());
    requireCallRecipient(t,actor);
    if(!t.pending())return new CallMediaResponse(view(t,actor),null);
    if(t.getStatus()!=WorkTransfer.Status.CONNECTING)throw conflict("먼저 통화 이관을 수락해 주세요.");
    if(!Objects.equals(t.getVersion(),expectedVersion))throw conflict("통화 이관 상태가 변경되었습니다. 다시 조회해 주세요.");
    var invalid=invalid(t);if(invalid!=null){finish(t,systemActor(org),invalid.status(),invalid.reason());return new CallMediaResponse(view(t,actor),null);}
    return new CallMediaResponse(view(t,actor),media.createToken(org+"-"+t.getQueueCode(),t.getTargetMediaIdentity(),actor.name(),false));
  }
  @Transactional public View confirmCall(String id,long expectedVersion){
    String org=access.organizationId();acquire(org);var actor=access.require("transfer:read");var t=read(actor,id);lockedRecord(org,t.getConsultationId());requireCallRecipient(t,actor);
    if(!t.pending())return view(t,actor);
    if(t.getStatus()!=WorkTransfer.Status.CONNECTING)throw conflict("먼저 통화 이관을 수락해 주세요.");
    if(!Objects.equals(t.getVersion(),expectedVersion))throw conflict("통화 이관 상태가 변경되었습니다. 다시 조회해 주세요.");
    var invalid=invalid(t);if(invalid!=null)finish(t,systemActor(org),invalid.status(),invalid.reason());else confirmLocked(t);
    return view(t,actor);
  }
  private void requireCallRecipient(WorkTransfer t,WorkspaceAccess.Actor actor){if(t.getKind()!=WorkTransfer.Kind.CALL||!recipient(t,actor))throw forbidden();}
  private void confirmLocked(WorkTransfer t){
    String room=t.getOrganizationId()+"-"+t.getQueueCode();kr.shnea.hellow.livekit.LiveKitService.ParticipantConnection target,source,customer;
    try{target=media.participantConnection(room,t.getTargetMediaIdentity());source=media.participantConnection(room,t.getFromMediaIdentity());customer=media.participantConnection(room,"customer-"+t.getQueueCode());}
    catch(Exception unavailable){return;} // Keep persisted CONNECTING; timeout/restart reconciliation owns recovery.
    if(target==null||source==null||customer==null||!target.active()||!target.microphonePublished()||target.sid()==null||target.sid().isBlank()||!source.active()||!customer.active())return;
    var record=record(t.getOrganizationId(),t.getConsultationId());var q=sourceQueue(record,true);var recipient=actor(members.findById(t.getToMemberId()).orElseThrow());
    t.confirmed(target.sid(),clock.instant());record.handoff(recipient);records.saveAndFlush(record);q.handoff(recipient);q.useMediaIdentity(t.getTargetMediaIdentity());queues.saveAndFlush(q);
    presence.findByIssuerAndSubject(recipient.issuer(),recipient.subject()).orElseThrow().beginWork(t.getOrganizationId(),q.getCode(),clock.instant());
    finish(t,recipient,WorkTransfer.Status.ACCEPTED,t.getOutcome());
  }
  private void reconcileLocked(String org){for(var t:transfers.findByOrganizationIdAndStatusIn(org,PENDING)){if(records.findByOrganizationIdAndId(org,t.getConsultationId()).isPresent())lockedRecord(org,t.getConsultationId());var invalid=invalid(t);if(invalid!=null)finish(t,systemActor(org),invalid.status(),invalid.reason());else if(t.getStatus()==WorkTransfer.Status.CONNECTING)confirmLocked(t);}transfers.flush();}
  private Invalid invalid(WorkTransfer t){
    if(!t.getExpiresAt().isAfter(clock.instant()))return new Invalid(WorkTransfer.Status.EXPIRED,"수락 기한이 만료되었습니다.");
    if(!organizations.findById(t.getOrganizationId()).map(Organization::isActive).orElse(false))return new Invalid(WorkTransfer.Status.REVOKED,"조직이 비활성화되었습니다.");
    var record=records.findByOrganizationIdAndId(t.getOrganizationId(),t.getConsultationId());
    if(record.isEmpty()||!Objects.equals(record.get().getVersion(),t.getRecordVersion())||!Objects.equals(record.get().getOwnerIssuer(),t.getFromIssuer())||!Objects.equals(record.get().getOwnerSubject(),t.getFromSubject()))
      return new Invalid(WorkTransfer.Status.FAILED,"원본 상담 또는 담당자가 변경되었습니다. 기존 책임을 유지하며 최신 기록에서 새 요청이 필요합니다.");
    var requester=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(t.getOrganizationId(),t.getRequesterIssuer(),t.getRequesterSubject());
    if(requester.isEmpty()||!maySend(actor(requester.get()),record.get()))return new Invalid(WorkTransfer.Status.REVOKED,"요청자의 이관 권한이 회수되었습니다.");
    var to=members.findById(t.getToMemberId());
    if(to.isEmpty()||!to.get().isActive()||!to.get().getOrganizationId().equals(t.getOrganizationId())||!eligible(to.get(),record.get(),t.isLiveWork(),t.getId()))return new Invalid(WorkTransfer.Status.REVOKED,"대상 직원의 권한 또는 수신 가능 상태가 변경되었습니다.");
    try{var q=sourceQueue(record.get(),t.getKind()==WorkTransfer.Kind.CALL);if(t.isLiveWork()&&(q==null||q.getStatus()!=QueueItem.QueueStatus.PROCESSING))return new Invalid(WorkTransfer.Status.FAILED,"원본 접수 처리가 종료되었습니다.");
      if(t.getKind()==WorkTransfer.Kind.CALL&&(q==null||q.getType()!=QueueItem.ItemType.CALL||q.isCallEnded()||!Objects.equals(q.getMediaAgentIdentity(),t.getFromMediaIdentity())))return new Invalid(WorkTransfer.Status.FAILED,"기존 통화가 종료 또는 변경되었습니다.");
      if(t.getKind()==WorkTransfer.Kind.CALL&&(!actor(requester.get()).can("queue:accept",q)||!actor(requester.get()).can("queue:read",q)))return new Invalid(WorkTransfer.Status.REVOKED,"기존 상담사의 통화 권한이 회수되었습니다.");}
    catch(ResponseStatusException e){return new Invalid(WorkTransfer.Status.FAILED,"원본 접수 상태가 변경되었습니다.");}
    return null;
  }
  private boolean eligible(Membership member,Consultation record,boolean live,String reservationId){
    var actor=actor(member);var proposed=new OrganizationOwned(){};proposed.setOrganizationId(record.getOrganizationId());proposed.assignOwner(actor);
    if(!actor.can("consultation:read",proposed)||!actor.can("consultation:write",proposed)||!actor.grants().containsKey("transfer:read"))return false;
    if(!live)return true;
    if(!actor.grants().containsKey("queue:read")||!actor.grants().containsKey("queue:accept"))return false;
    var p=presence.findByIssuerAndSubject(member.getIssuer(),member.getSubject());var now=clock.instant();
    return p.filter(row->row.getOrganizationId().equals(record.getOrganizationId())&&row.live(now)&&row.getAvailability()==AgentPresence.Availability.AVAILABLE&&attempts.activeForPresence(row.getId()).isEmpty()).isPresent()
      &&queues.activeForIdentity(member.getIssuer(),member.getSubject()).isEmpty()&&followups.activeForIdentity(member.getIssuer(),member.getSubject()).isEmpty()
      &&transfers.reservations(member.getIssuer(),member.getSubject()).stream().noneMatch(t->!Objects.equals(t.getId(),reservationId));
  }
  private QueueItem sourceQueue(Consultation record){
    return sourceQueue(record,false);
  }
  private QueueItem sourceQueue(Consultation record,boolean call){
    if(record.getQueueCode()==null)return null;
    var q=queues.findByOrganizationIdAndCode(record.getOrganizationId(),record.getQueueCode()).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    if(q.getStatus()!=QueueItem.QueueStatus.PROCESSING&&q.getStatus()!=QueueItem.QueueStatus.COMPLETED)throw conflict("수락한 상담 또는 완료된 기록에서 이관해 주세요.");
    if(q.getStatus()==QueueItem.QueueStatus.PROCESSING){
      if(!Objects.equals(q.getOwnerIssuer(),record.getOwnerIssuer())||!Objects.equals(q.getAssignedSubject(),record.getOwnerSubject()))throw conflict("상담과 접수 담당자가 일치하지 않습니다.");
      if(!call&&q.getType()==QueueItem.ItemType.CALL&&!q.isCallEnded())throw conflict("진행 중 음성은 통화 이관으로 넘겨야 합니다.");
    }
    return q;
  }
  private boolean maySend(WorkspaceAccess.Actor actor,Consultation record){return actor.can("consultation:transfer",record)&&actor.can("consultation:read",record)&&actor.can("consultation:write",record)
      &&(Objects.equals(actor.issuer(),record.getOwnerIssuer())&&Objects.equals(actor.subject(),record.getOwnerSubject())||actor.grants().get("organization:admin")==DataScope.ORGANIZATION);}
  private void requireSender(WorkspaceAccess.Actor actor,Consultation record){if(!maySend(actor,record))throw new ResponseStatusException(NOT_FOUND,"이관할 수 있는 상담이 없습니다.");}
  private boolean mayCancel(WorkTransfer t,WorkspaceAccess.Actor actor){return (same(actor,t.getRequesterIssuer(),t.getRequesterSubject())||same(actor,t.getFromIssuer(),t.getFromSubject())||actor.grants().get("organization:admin")==DataScope.ORGANIZATION)
      &&records.findByOrganizationIdAndId(actor.organizationId(),t.getConsultationId()).map(r->maySend(actor,r)).orElse(false);}
  private View view(WorkTransfer t,WorkspaceAccess.Actor actor){
    boolean pending=t.pending();var record=records.findByOrganizationIdAndId(actor.organizationId(),t.getConsultationId());
    return new View(t,t.getStatus()==WorkTransfer.Status.OFFERED&&recipient(t,actor)&&invalid(t)==null,pending&&recipient(t,actor),pending&&mayCancel(t,actor),record.map(r->actor.can("consultation:read",r)).orElse(false));
  }
  private WorkTransfer read(WorkspaceAccess.Actor actor,String id){return transfers.findOne(scope(actor).and(BusinessScope.equal("id",id))).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private Specification<WorkTransfer> scope(WorkspaceAccess.Actor actor){
    var reader=actor.forPermission("transfer:read").orElseThrow(WorkTransferService::forbidden);
    return BusinessScope.<WorkTransfer>rows(reader).or((root,query,cb)->cb.and(cb.equal(root.get("organizationId"),reader.organizationId()),cb.or(
      cb.and(cb.equal(root.get("toIssuer"),reader.issuer()),cb.equal(root.get("toSubject"),reader.subject())),
      cb.and(cb.equal(root.get("requesterIssuer"),reader.issuer()),cb.equal(root.get("requesterSubject"),reader.subject())),
      reader.dataScope()==DataScope.TEAM&& !reader.teamIds().isEmpty()?root.get("toTeamId").in(reader.teamIds()):cb.disjunction())));
  }
  private Consultation record(String org,Long id){return records.findByOrganizationIdAndId(org,id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private Consultation lockedRecord(String org,Long id){
    var record=record(org,id);
    if(record.getQueueCode()!=null)queues.lockByCode(org,record.getQueueCode()).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    entityManager.refresh(record,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);return record;
  }
  private void acquire(String org){lock.acquire().orElseThrow();organizations.lockById(org).orElseThrow(()->new ResponseStatusException(NOT_FOUND));}
  private WorkspaceAccess.Actor actor(Membership m){var grants=authority.grants(m);return new WorkspaceAccess.Actor(m.getOrganizationId(),m.getSubject(),name(m),m.getIssuer(),m.getTeamId(),DataScope.SELF,authority.teamScope(m),grants);}
  private WorkspaceAccess.Actor systemActor(String org){return new WorkspaceAccess.Actor(org,"work-transfer-worker","업무 이관 처리", "internal:hellow",null,DataScope.SELF,Set.of(),Map.of());}
  private void finish(WorkTransfer t,WorkspaceAccess.Actor actor,WorkTransfer.Status status,String reason){t.finish(status,reason,clock.instant());transfers.saveAndFlush(t);event(t,actor,status.name(),reason);}
  private void event(WorkTransfer t,WorkspaceAccess.Actor actor,String action,String reason){events.save(new WorkTransferEvent(t,actor,action,reason,clock.instant()));audits.save(new AuditEvent(t.getOrganizationId(),actor.issuer(),actor.subject(),"transfer."+(t.getKind()==WorkTransfer.Kind.CALL?"call":"work")+"."+action.toLowerCase(Locale.ROOT),t.getId(),"이관 상태 "+action));}
  private boolean recipient(WorkTransfer t,WorkspaceAccess.Actor actor){return same(actor,t.getToIssuer(),t.getToSubject());}
  private boolean same(WorkspaceAccess.Actor actor,String issuer,String subject){return Objects.equals(actor.issuer(),issuer)&&Objects.equals(actor.subject(),subject);}
  private boolean same(Membership m,String issuer,String subject){return Objects.equals(m.getIssuer(),issuer)&&Objects.equals(m.getSubject(),subject);}
  private String name(Membership m){return m.getDisplayName()==null?m.getSubject():m.getDisplayName();}
  private String key(WorkspaceAccess.Actor actor,String uuid){if(uuid==null||!uuid.matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))throw bad("유효한 요청 ID를 지정해 주세요.");return hash(Arrays.asList(actor.organizationId(),actor.issuer(),actor.subject(),UUID.fromString(uuid).toString()));}
  private String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}catch(Exception e){throw new IllegalStateException(e);}}
  private void page(int page){if(page<0||page>10000)throw bad("조회 페이지를 확인해 주세요.");}
  private static ResponseStatusException forbidden(){return new ResponseStatusException(FORBIDDEN);}
  private static ResponseStatusException bad(String message){return new ResponseStatusException(BAD_REQUEST,message);}
  private static ResponseStatusException conflict(String message){return new ResponseStatusException(CONFLICT,message);}
}
