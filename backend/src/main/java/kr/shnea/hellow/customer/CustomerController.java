package kr.shnea.hellow.customer;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customerRepository;

    public CustomerController(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @GetMapping
    public List<Customer> getAll() {
        return customerRepository.findAll();
    }

    @GetMapping("/{code}")
    public ResponseEntity<Customer> getByCode(@PathVariable String code) {
        return customerRepository.findByCode(code)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public record CustomerRequest(
            String customerType,
            String name,
            String company,
            String department,
            String title,
            String tier,
            String phoneNumber,
            String email,
            String customerNotes,
            boolean complainant
    ) {}

    @PostMapping
    public ResponseEntity<Customer> register(@RequestBody CustomerRequest request) {
        Customer.CustomerType type = "INDIVIDUAL".equalsIgnoreCase(request.customerType())
                ? Customer.CustomerType.INDIVIDUAL
                : Customer.CustomerType.CORPORATE;

        String code = "cust-" + UUID.randomUUID().toString().substring(0, 8);
        Customer customer = new Customer(
                code,
                type,
                true,
                request.name(),
                request.company(),
                request.department(),
                request.title(),
                request.tier(),
                request.phoneNumber(),
                request.email(),
                "이소연 선임 (본인)",
                request.customerNotes(),
                request.complainant()
        );

        return ResponseEntity.ok(customerRepository.save(customer));
    }

    @PutMapping("/{code}")
    public ResponseEntity<Customer> update(@PathVariable String code, @RequestBody CustomerRequest request) {
        return customerRepository.findByCode(code)
                .map(customer -> {
                    Customer.CustomerType type = "INDIVIDUAL".equalsIgnoreCase(request.customerType())
                            ? Customer.CustomerType.INDIVIDUAL
                            : Customer.CustomerType.CORPORATE;

                    customer.updateInfo(
                            type,
                            request.name(),
                            request.company(),
                            request.department(),
                            request.title(),
                            request.tier(),
                            request.email(),
                            request.customerNotes(),
                            request.complainant()
                    );
                    return ResponseEntity.ok(customerRepository.save(customer));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
