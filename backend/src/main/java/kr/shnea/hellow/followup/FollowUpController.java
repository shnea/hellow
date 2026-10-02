package kr.shnea.hellow.followup;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/followup")
public class FollowUpController {

    private final FollowUpRepository followUpRepository;

    public FollowUpController(FollowUpRepository followUpRepository) {
        this.followUpRepository = followUpRepository;
    }

    @GetMapping("/{customerCode}")
    public List<FollowUpAction> getActions(@PathVariable String customerCode) {
        return followUpRepository.findByCustomerCodeOrderByCreatedAtDesc(customerCode);
    }

    public record CreateFollowUpRequest(
            String customerCode,
            String actionType,
            String title,
            String details
    ) {}

    @PostMapping
    public ResponseEntity<FollowUpAction> createAction(@RequestBody CreateFollowUpRequest request) {
        FollowUpAction action = new FollowUpAction(
                request.customerCode(),
                request.actionType(),
                request.title(),
                request.details()
        );
        return ResponseEntity.ok(followUpRepository.save(action));
    }
}
