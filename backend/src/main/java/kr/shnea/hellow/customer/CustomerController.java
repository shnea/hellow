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

  public CustomerController(
      CustomerRepository customers, QueueItemRepository queues, WorkspaceAccess access) {
    this.customers = customers;
    this.queues = queues;
    this.access = access;
  }

  @GetMapping
  public List<Customer> all() {
    return customers.findAll(BusinessScope.customers(access.require("customer:read")));
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
  public Customer register(@Valid @RequestBody CustomerRequest r) {
    var actor = access.require("customer:write");
    if (r.queueCode() == null) throw new ResponseStatusException(BAD_REQUEST, "등록할 상담을 지정해 주세요.");
    var q =
        queues
            .lockByCode(actor.organizationId(), r.queueCode())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    if (q.getCustomerCode() != null) return owned(actor, q.getCustomerCode());
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
    queues.save(q);
    return c;
  }

  @PutMapping("/{code}")
  @Transactional
  public Customer update(@PathVariable String code, @Valid @RequestBody CustomerRequest r) {
    var actor = access.require("customer:write");
    var c = owned(actor, code);
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
  public Customer link(@PathVariable String code, @Valid @RequestBody LinkRequest request) {
    var actor = access.require("customer:write");
    var q =
        queues
            .lockByCode(actor.organizationId(), code)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
    q.requireOwner(actor.subject());
    if (q.getCustomerCode() != null && !q.getCustomerCode().equals(request.customerCode()))
      throw new ResponseStatusException(CONFLICT, "이미 연결된 고객을 임의로 바꿀 수 없습니다.");
    var customer = owned(actor, request.customerCode());
    q.linkCustomer(customer);
    queues.save(q);
    return customer;
  }

  private Customer owned(WorkspaceAccess.Actor actor, String code) {
    return customers
        .findOne(BusinessScope.customers(actor).and(BusinessScope.equal("code",code)))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
  }
}
