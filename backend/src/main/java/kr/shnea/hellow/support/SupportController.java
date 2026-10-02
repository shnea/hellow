package kr.shnea.hellow.support;

import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.customer.CustomerRepository;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.queue.QueueItemRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/support")
public class SupportController {

    private final QueueItemRepository queueItemRepository;
    private final CustomerRepository customerRepository;

    public SupportController(QueueItemRepository queueItemRepository, CustomerRepository customerRepository) {
        this.queueItemRepository = queueItemRepository;
        this.customerRepository = customerRepository;
    }

    @PostMapping("/request")
    public ResponseEntity<SupportResponse> createSupportRequest(@RequestBody SupportRequest request) {
        String cleanPhone = request.phoneNumber() != null ? request.phoneNumber().trim() : "";
        Optional<Customer> existingCustomer = customerRepository.findByPhoneNumber(cleanPhone);

        Customer.CustomerType custType;
        if (request.customerType() != null) {
            custType = request.customerType();
        } else if ("B2B".equalsIgnoreCase(request.typeString()) || "CORPORATE".equalsIgnoreCase(request.typeString())) {
            custType = Customer.CustomerType.CORPORATE;
        } else {
            custType = existingCustomer.map(Customer::getCustomerType).orElse(Customer.CustomerType.INDIVIDUAL);
        }

        boolean isRegistered = existingCustomer.isPresent();
        boolean isComplainant = existingCustomer.map(Customer::isComplainant).orElse(false);

        // 컴플레인 키워드 자동 감지
        String summaryText = (request.message() != null ? request.message() : "") + " " +
                (request.inquiryType() != null ? request.inquiryType() : "");
        if (summaryText.contains("환불") || summaryText.contains("불만") ||
                summaryText.contains("항의") || summaryText.contains("피해") ||
                summaryText.contains("컴플레인") || "컴플레인".equals(request.inquiryType())) {
            isComplainant = true;
        }

        String code = "queue-web-" + UUID.randomUUID().toString().substring(0, 8);
        String sessionId = "sess-" + UUID.randomUUID().toString().substring(0, 12);

        QueueItem.ItemType itemType = "CHAT".equalsIgnoreCase(request.channel()) ?
                QueueItem.ItemType.TICKET : QueueItem.ItemType.CALL;

        String priority = isComplainant ? "urgent" : "normal";
        String customerName = (request.customerName() != null && !request.customerName().isBlank()) ?
                request.customerName() : (existingCustomer.map(Customer::getName).orElse("익명 문의 고객"));

        String companyName = (custType == Customer.CustomerType.CORPORATE && request.companyName() != null) ?
                request.companyName() : (existingCustomer.map(Customer::getCompany).orElse(null));

        QueueItem item = new QueueItem(
                code,
                itemType,
                custType,
                customerName,
                companyName,
                cleanPhone.isBlank() ? "웹 상담 접속" : cleanPhone,
                "방금 인입 (웹 접수)",
                priority,
                request.message(),
                true,
                isRegistered,
                isComplainant
        );
        item.setSessionId(sessionId);
        item.setInquiryType(request.inquiryType() != null ? request.inquiryType() : "웹 실시간 상담");

        queueItemRepository.save(item);

        long waitingCount = queueItemRepository.countByStatus(QueueItem.QueueStatus.WAITING);

        return ResponseEntity.ok(new SupportResponse(
                sessionId,
                code,
                item.getStatus().name(),
                null,
                waitingCount,
                Math.max(30, waitingCount * 60)
        ));
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<SessionStatusResponse> getSessionStatus(@PathVariable String sessionId) {
        return ResponseEntity.of(queueItemRepository.findBySessionId(sessionId)
                .map(item -> new SessionStatusResponse(
                        item.getSessionId(),
                        item.getCode(),
                        item.getStatus().name(),
                        item.getAssignedAgent(),
                        item.getInquiryType(),
                        item.getCustomerName(),
                        item.getSummary(),
                        item.getCreatedAt().toString()
                )));
    }

    @PostMapping("/session/{sessionId}/cancel")
    public ResponseEntity<Void> cancelSession(@PathVariable String sessionId) {
        return queueItemRepository.findBySessionId(sessionId)
                .map(item -> {
                    item.cancel();
                    queueItemRepository.save(item);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public record SupportRequest(
            String customerName,
            String companyName,
            String phoneNumber,
            Customer.CustomerType customerType,
            String typeString,
            String inquiryType,
            String message,
            String channel
    ) {}

    public record SupportResponse(
            String sessionId,
            String queueCode,
            String status,
            String assignedAgent,
            long queuePosition,
            long estimatedWaitSeconds
    ) {}

    public record SessionStatusResponse(
            String sessionId,
            String queueCode,
            String status,
            String assignedAgent,
            String inquiryType,
            String customerName,
            String message,
            String createdAt
    ) {}
}
