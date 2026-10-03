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

  public TimelineController(
      TimelineRepository timelines,
      WorkspaceAccess access,
      CustomerRepository customers,
      QueueItemRepository queues) {
    this.timelines = timelines;
    this.access = access;
    this.customers = customers;
    this.queues = queues;
  }

  @GetMapping("/customer/{code}")
  public List<TimelineItem> customer(@PathVariable String code) {
    var actor = access.require("consultation:read");
    customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    return timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and(BusinessScope.equal("customerCode",code)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt"));
  }

  @GetMapping("/queue/{code}")
  public List<TimelineItem> queue(@PathVariable String code) {
    var actor = access.require("consultation:read");
    var queue=queues
        .findByOrganizationIdAndCode(actor.organizationId(), code)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    actor.requireRow(queue);
    return timelines.findAll(BusinessScope.<TimelineItem>rows(actor).and(BusinessScope.equal("queueCode",code)),
        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"createdAt"));
  }
}
