package kr.shnea.hellow.consultation;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/consultations")
public class ConsultationController {

    private final ConsultationRepository consultationRepository;

    public ConsultationController(ConsultationRepository consultationRepository) {
        this.consultationRepository = consultationRepository;
    }

    public record SaveConsultationRequest(
            String customerCode,
            String categoryMain,
            String categorySub,
            String status,
            String memo,
            String tags,
            String agentName,
            int callDurationSeconds
    ) {}

    @GetMapping("/customer/{customerCode}")
    public List<Consultation> getByCustomer(@PathVariable String customerCode) {
        return consultationRepository.findByCustomerCodeOrderByCreatedAtDesc(customerCode);
    }

    @PostMapping
    public ResponseEntity<Consultation> save(@RequestBody SaveConsultationRequest request) {
        Consultation.ConsultationStatus status = switch (request.status().toUpperCase()) {
            case "COMPLETED" -> Consultation.ConsultationStatus.COMPLETED;
            case "ESCALATED" -> Consultation.ConsultationStatus.ESCALATED;
            default -> Consultation.ConsultationStatus.IN_PROGRESS;
        };

        Consultation consultation = new Consultation(
                request.customerCode(),
                request.categoryMain(),
                request.categorySub(),
                status,
                request.memo(),
                request.tags(),
                request.agentName() != null ? request.agentName() : "이소연 선임 (본인)",
                request.callDurationSeconds()
        );

        return ResponseEntity.ok(consultationRepository.save(consultation));
    }
}
