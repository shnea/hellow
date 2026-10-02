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
    public List<QueueItem> getWaitingItems() {
        return queueItemRepository.findByStatusOrderByCreatedAtDesc(QueueItem.QueueStatus.WAITING);
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
}
