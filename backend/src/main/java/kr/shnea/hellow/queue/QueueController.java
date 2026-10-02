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
  private final MembershipRepository members;
  private final LiveKitService media;

  public QueueController(
      QueueItemRepository queues,
      WorkspaceAccess access,
      MembershipRepository members,
      LiveKitService media) {
    this.queues = queues;
    this.access = access;
    this.members = members;
    this.media = media;
  }

  @GetMapping
  public List<QueueItem> list() {
    var actor = access.require("queue:read");
    return queues.findByOrganizationIdAndStatusInOrderByCreatedAtDesc(
        actor.organizationId(),
        List.of(QueueItem.QueueStatus.WAITING, QueueItem.QueueStatus.PROCESSING));
  }

  @PostMapping("/{code}/accept")
  @Transactional
  public QueueItem accept(@PathVariable String code) {
    var actor = access.require("queue:accept");
    members
        .lockActive(
            actor.organizationId(), access.identity().getIssuer().toString(), actor.subject())
        .orElseThrow(() -> new ResponseStatusException(FORBIDDEN));
    var q = lock(actor, code);
    if (q.getStatus() == QueueItem.QueueStatus.PROCESSING
        && actor.subject().equals(q.getAssignedSubject())) return q;
    if (q.getType() == QueueItem.ItemType.CALL
        && queues.existsByOrganizationIdAndAssignedSubjectAndStatusAndCallEndedFalseAndType(
            actor.organizationId(),
            actor.subject(),
            QueueItem.QueueStatus.PROCESSING,
            QueueItem.ItemType.CALL))
      throw new ResponseStatusException(CONFLICT, "진행 중인 통화를 먼저 종료해 주세요.");
    q.acceptBy(actor.subject(), actor.name());
    return queues.save(q);
  }

  @PostMapping("/{code}/token")
  public LiveKitService.LiveKitTokenResponse token(@PathVariable String code) {
    var actor = access.require("queue:accept");
    var q =
        queues
            .findByOrganizationIdAndCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    if (q.isCallEnded() || q.getType() != QueueItem.ItemType.CALL)
      throw new ResponseStatusException(CONFLICT, "활성 음성 통화가 아닙니다.");
    return media.createToken(
        actor.organizationId() + "-" + q.getCode(),
        "agent-" + actor.subject(),
        actor.name(),
        false);
  }

  @PostMapping("/{code}/end-call")
  @Transactional
  public QueueItem end(@PathVariable String code) {
    var actor = access.require("queue:accept");
    var q = lock(actor, code);
    q.requireOwner(actor.subject());
    q.endCall();
    return queues.save(q);
  }

  private QueueItem lock(WorkspaceAccess.Actor actor, String code) {
    return queues
        .lockByCode(actor.organizationId(), code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
  }
}
