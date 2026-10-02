package kr.shnea.hellow.queue;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/queue")
public class QueueController {

    private final QueueItemRepository queueItemRepository;

    public QueueController(QueueItemRepository queueItemRepository) {
        this.queueItemRepository = queueItemRepository;
    }

    @GetMapping
    public List<QueueItem> getActiveItems(@RequestParam(required = false) String status) {
        if ("waiting".equalsIgnoreCase(status)) {
            return queueItemRepository.findByStatusOrderByCreatedAtDesc(QueueItem.QueueStatus.WAITING);
        }
        return queueItemRepository.findByStatusInOrderByCreatedAtDesc(
                List.of(QueueItem.QueueStatus.WAITING, QueueItem.QueueStatus.PROCESSING)
        );
    }

    @PostMapping("/{code}/accept")
    public ResponseEntity<QueueItem> acceptQueueItem(
            @PathVariable String code,
            @RequestBody(required = false) AcceptRequest request) {
        String agent = (request != null && request.agentName() != null) ? request.agentName() : "홍상담 매니저 (상담1팀)";
        return queueItemRepository.findByCode(code)
                .map(item -> {
                    item.accept(agent);
                    QueueItem saved = queueItemRepository.save(item);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{code}/complete")
    public ResponseEntity<Void> completeQueueItem(@PathVariable String code) {
        return queueItemRepository.findByCode(code)
                .map(item -> {
                    item.complete();
                    queueItemRepository.save(item);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{code}/cancel")
    public ResponseEntity<Void> cancelQueueItem(@PathVariable String code) {
        return queueItemRepository.findByCode(code)
                .map(item -> {
                    item.cancel();
                    queueItemRepository.save(item);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public record AcceptRequest(String agentName) {}
}
