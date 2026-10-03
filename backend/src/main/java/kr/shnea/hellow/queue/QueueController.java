package kr.shnea.hellow.queue;

import static org.springframework.http.HttpStatus.*;

import java.util.*;
import kr.shnea.hellow.livekit.LiveKitService;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/queue")
public class QueueController {
  private final QueueItemRepository queues;
  private final WorkspaceAccess access;
  private final kr.shnea.hellow.routing.RoutingService routing;
  private final LiveKitService media;

  public QueueController(
      QueueItemRepository queues,
      WorkspaceAccess access,
      kr.shnea.hellow.routing.RoutingService routing,
      LiveKitService media) {
    this.queues = queues;
    this.access = access;
    this.routing = routing;
    this.media = media;
  }

  @GetMapping
  public List<kr.shnea.hellow.routing.RoutingService.QueueView> list() {
    var actor = access.require("queue:read");
    org.springframework.data.jpa.domain.Specification<QueueItem> scope=BusinessScope.rows(actor);
    // A routing offer grants visibility only to its recipient, never to every available agent.
    if(actor.grants().containsKey("queue:accept"))scope=scope.or((root,query,cb)->{
      var offer=query.subquery(Integer.class);var a=offer.from(kr.shnea.hellow.routing.AssignmentAttempt.class);
      offer.select(cb.literal(1)).where(cb.equal(a.get("organizationId"),actor.organizationId()),
          cb.equal(a.get("queueCode"),root.get("code")),cb.equal(a.get("agentIssuer"),actor.issuer()),
          cb.equal(a.get("agentSubject"),actor.subject()),a.get("outcome").in(
              kr.shnea.hellow.routing.AssignmentAttempt.Outcome.OFFERED,kr.shnea.hellow.routing.AssignmentAttempt.Outcome.RINGING),
          cb.greaterThan(a.get("expiresAt"),java.time.Instant.now()));
      return cb.and(cb.equal(root.get("organizationId"),actor.organizationId()),
          cb.equal(root.get("status"),QueueItem.QueueStatus.WAITING),cb.exists(offer));
    });
    return routing.decorate(queues.findAll(scope.and((root,query,cb)->root.get("status").in(List.of(QueueItem.QueueStatus.WAITING,QueueItem.QueueStatus.PROCESSING))),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt")),actor);
  }

  public record HistoryPage(List<kr.shnea.hellow.routing.RoutingService.QueueView> items, int page, boolean hasMore) {}

  @GetMapping("/history")
  public HistoryPage history(@RequestParam(defaultValue="ALL") String status, @RequestParam(defaultValue="0") int page) {
    var actor=access.require("queue:read");
    if(page<0||page>100000)throw new ResponseStatusException(BAD_REQUEST,"조회 페이지를 확인해 주세요.");
    var statuses=switch(status){
      case "ALL" -> List.of(QueueItem.QueueStatus.COMPLETED,QueueItem.QueueStatus.CANCELLED);
      case "COMPLETED" -> List.of(QueueItem.QueueStatus.COMPLETED);
      case "CANCELLED" -> List.of(QueueItem.QueueStatus.CANCELLED);
      default -> throw new ResponseStatusException(BAD_REQUEST,"조회 상태를 확인해 주세요.");
    };
    org.springframework.data.jpa.domain.Specification<QueueItem> scope=BusinessScope.rows(actor);
    var rows=queues.findAll(scope.and((root,query,cb)->root.get("status").in(statuses)),
        org.springframework.data.domain.PageRequest.of(page,50,org.springframework.data.domain.Sort.by(
            org.springframework.data.domain.Sort.Order.desc("createdAt"),org.springframework.data.domain.Sort.Order.desc("id"))));
    return new HistoryPage(routing.decorate(rows.getContent(),actor),page,rows.hasNext());
  }

  public record AcceptRequest(String attemptId){}
  @PostMapping("/{code}/accept")
  public QueueItem accept(@PathVariable String code,@RequestBody(required=false) AcceptRequest request) {
    return routing.accept(access.require("queue:accept"),code,request==null?null:request.attemptId());
  }
  public record RejectRequest(@jakarta.validation.constraints.NotBlank String attemptId){}
  @PostMapping("/{code}/reject")
  public kr.shnea.hellow.routing.RoutingService.AgentView reject(@PathVariable String code,@RequestBody @jakarta.validation.Valid RejectRequest request){return routing.reject(access.require("queue:accept"),code,request.attemptId());}
  @GetMapping("/{code}/attempts")
  public List<kr.shnea.hellow.routing.RoutingService.AttemptView> attempts(@PathVariable String code){return routing.history(access.require("queue:read"),code);}
  public record RestartRequest(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Min(0) Long expectedVersion){}
  @PostMapping("/{code}/restart-routing")
  public void restart(@PathVariable String code,@RequestBody @jakarta.validation.Valid RestartRequest request){routing.restart(access.require("queue:accept"),code,request.expectedVersion());}

  @PostMapping("/{code}/token")
  @Transactional
  public LiveKitService.LiveKitTokenResponse token(@PathVariable String code) {
    var actor = access.require("queue:accept");
    var q = lock(actor,code);
    requireOwner(q,actor);
    if (q.isCallEnded() || q.getType() != QueueItem.ItemType.CALL)
      throw new ResponseStatusException(CONFLICT, "활성 음성 통화가 아닙니다.");
    q.requestMedia(java.time.Instant.now());
    return media.createToken(
        actor.organizationId() + "-" + q.getCode(),
        q.getMediaAgentIdentity(),
        actor.name(),
        false);
  }

  @PostMapping("/{code}/end-call")
  @Transactional
  public QueueItem end(@PathVariable String code) {
    var actor = access.require("queue:accept");
    var q = lock(actor, code);
    requireOwner(q,actor);
    q.endCall();
    return queues.save(q);
  }

  private QueueItem lock(WorkspaceAccess.Actor actor, String code) {
    return queues
        .lockByCode(actor.organizationId(), code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
  }
  private void requireOwner(QueueItem q,WorkspaceAccess.Actor actor){
    q.requireOwner(actor.subject());
    if(q.getOwnerIssuer()!=null&&!actor.issuer().equals(q.getOwnerIssuer()))
      throw new ResponseStatusException(CONFLICT,"본인이 수락한 활성 상담만 처리할 수 있습니다.");
  }
}
