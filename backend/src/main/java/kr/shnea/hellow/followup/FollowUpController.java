package kr.shnea.hellow.followup;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/followup")
public class FollowUpController {
  private final FollowUpRepository followups;
  private final QueueItemRepository queues;
  private final TimelineRepository timelines;
  private final WorkspaceAccess access;

  public FollowUpController(
      FollowUpRepository followups,
      QueueItemRepository queues,
      TimelineRepository timelines,
      WorkspaceAccess access) {
    this.followups = followups;
    this.queues = queues;
    this.timelines = timelines;
    this.access = access;
  }

  public record Request(
      @NotBlank String queueCode,
      @NotBlank @Pattern(regexp = "VISIT|CALLBACK") String actionType,
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 10000) String details) {}

  @PostMapping
  @Transactional
  public FollowUpAction create(@Valid @RequestBody Request r) {
    var actor = access.require("followup:write");
    var q =
        queues
            .lockByCode(actor.organizationId(), r.queueCode())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    var action = new FollowUpAction(q.getCustomerCode(), r.actionType(), r.title(), r.details());
    action.setOrganizationId(actor.organizationId());
    action.setQueueCode(q.getCode());
    action.copyOwner(q);
    followups.save(action);
    var item =
        new TimelineItem(
            q.getCustomerCode(),
            TimelineItem.ChannelType.TICKET,
            actor.name(),
            "[접수·미확정] " + r.title(),
            r.details(),
            false,
            null,
            "후속조치,PENDING");
    item.setOrganizationId(actor.organizationId());
    item.setQueueCode(q.getCode());
    item.copyOwner(q);
    timelines.save(item);
    return action;
  }
}
