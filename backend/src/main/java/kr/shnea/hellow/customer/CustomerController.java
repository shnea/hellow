package kr.shnea.hellow.customer;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
  private final CustomerRepository customers;
  private final QueueItemRepository queues;
  private final WorkspaceAccess access;
  private final com.fasterxml.jackson.databind.ObjectMapper json;
  private final CustomerHistoryService history;
  private final AuditEvents audit;

  public CustomerController(
      CustomerRepository customers, QueueItemRepository queues, WorkspaceAccess access,com.fasterxml.jackson.databind.ObjectMapper json,CustomerHistoryService history,AuditEvents audit) {
    this.customers = customers;
    this.queues = queues;
    this.access = access;
    this.json=json;
    this.history=history;this.audit=audit;
  }

  @GetMapping
  public List<Map<String,Object>> all() {
    var actor=access.require("customer:read");
    var editable=actor.forPermission("customer:write").map(writer->customers.findAll(BusinessScope.customers(writer)).stream()
        .map(Customer::getCode).collect(java.util.stream.Collectors.toSet())).orElseGet(Set::of);
    return customers.findAll(BusinessScope.customers(actor)).stream().map(c->{
      Map<String,Object> view=json.convertValue(c,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
      view.put("editable",editable.contains(c.getCode()));return view;
    }).toList();
  }

  @GetMapping("/{code}")
  public Customer get(@PathVariable String code) {
    return owned(access.require("customer:read"), code);
  }

  public record CustomerRequest(
      @NotBlank @Pattern(regexp = "CORPORATE|INDIVIDUAL") String customerType,
      @NotBlank @Size(max = 100) String name,
      @Size(max = 150) String company,
      @Size(max = 100) String department,
      @Size(max = 100) String title,
      @Pattern(regexp = "VIP|Gold|Standard") String tier,
      @NotBlank @Size(max = 50) String phoneNumber,
      @Size(max = 255) String email,
      @Size(max = 10000) String customerNotes,
      boolean complainant,
      String queueCode) {}

  @PostMapping
  @Transactional
  public Map<String,Object> register(@Valid @RequestBody CustomerRequest r) {
    var actor = access.require("customer:write");
    if (r.queueCode() == null) throw new ResponseStatusException(BAD_REQUEST, "등록할 상담을 지정해 주세요.");
    var q =
        queues
            .lockByCode(actor.organizationId(), r.queueCode())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    requireIdentityOwner(actor,q);
    actor.requireRow(q);
    if (q.getCustomerCode() != null) {
      var existing=owned(actor,q.getCustomerCode());history.synchronize(q,null,existing.getCode(),actor,false);return linkedView(existing,q);
    }
    Customer c =
        new Customer(
            "cust-" + UUID.randomUUID(),
            Customer.CustomerType.valueOf(r.customerType()),
            true,
            r.name(),
            r.company(),
            r.department(),
            r.title(),
            r.tier(),
            r.phoneNumber(),
            r.email(),
            actor.name(),
            r.customerNotes(),
            r.complainant());
    c.setOrganizationId(actor.organizationId());
    c.assignOwner(actor);
    customers.save(c);
    q.linkCustomer(c);
    history.synchronize(q,null,c.getCode(),actor,false);
    queues.save(q);
    audit.record(actor.organizationId(),"customer.register",c.getCode(),"queue="+q.getCode());
    return linkedView(c,q);
  }

  @PutMapping("/{code}")
  @Transactional
  public Customer update(@PathVariable String code, @Valid @RequestBody CustomerRequest r) {
    var actor = access.require("customer:write");
    var c = owned(actor, code);
    c.changePhoneNumber(r.phoneNumber().trim());
    c.updateInfo(
        Customer.CustomerType.valueOf(r.customerType()),
        r.name(),
        r.company(),
        r.department(),
        r.title(),
        r.tier(),
        r.email(),
        r.customerNotes(),
        r.complainant());
    return customers.save(c);
  }

  public record LinkRequest(@NotBlank String customerCode) {}

  @PostMapping("/queue/{code}/link")
  @Transactional
  public Map<String,Object> link(@PathVariable String code, @Valid @RequestBody LinkRequest request) {
    var actor = access.require("customer:write");
    var q =
        queues
            .lockByCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    requireIdentityOwner(actor,q);
    actor.requireRow(q);
    if (q.getCustomerCode() != null && !q.getCustomerCode().equals(request.customerCode()))
      throw new ResponseStatusException(CONFLICT, "이미 연결된 고객을 임의로 바꿀 수 없습니다.");
    var customer = owned(actor, request.customerCode());
    q.linkCustomer(customer);
    history.synchronize(q,null,customer.getCode(),actor,false);
    queues.save(q);
    audit.record(actor.organizationId(),"customer.queue.link",customer.getCode(),"queue="+q.getCode());
    return linkedView(customer,q);
  }

  private Map<String,Object> linkedView(Customer customer,QueueItem q){
    Map<String,Object> view=json.convertValue(customer,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>(){});
    var record=history.record(q);view.put("consultationVersion",record==null?0:record.getVersion());return view;
  }
  private void requireIdentityOwner(WorkspaceAccess.Actor actor,QueueItem q){
    if(!actor.issuer().equals(q.getOwnerIssuer())||!actor.subject().equals(q.getOwnerSubject()))
      throw new ResponseStatusException(NOT_FOUND,"본인이 수락한 상담이 아닙니다.");
  }

  private Customer owned(WorkspaceAccess.Actor actor, String code) {
    return customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
  }
}
