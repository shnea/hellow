package kr.shnea.hellow.timeline;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/timeline")
public class TimelineController {

    private final TimelineRepository timelineRepository;

    public TimelineController(TimelineRepository timelineRepository) {
        this.timelineRepository = timelineRepository;
    }

    @GetMapping("/{customerCode}")
    public List<TimelineItem> getTimeline(@PathVariable String customerCode) {
        return timelineRepository.findByCustomerCodeOrderByCreatedAtDesc(customerCode);
    }

    public record CreateTimelineRequest(
            String customerCode,
            String channel,
            String agentName,
            String title,
            String content,
            boolean hasAudio,
            String audioDuration,
            String tags
    ) {}

    @PostMapping
    public ResponseEntity<TimelineItem> createItem(@RequestBody CreateTimelineRequest request) {
        TimelineItem.ChannelType channelType = switch (request.channel().toLowerCase()) {
            case "call" -> TimelineItem.ChannelType.CALL;
            case "email" -> TimelineItem.ChannelType.EMAIL;
            case "chat" -> TimelineItem.ChannelType.CHAT;
            default -> TimelineItem.ChannelType.TICKET;
        };

        TimelineItem item = new TimelineItem(
                request.customerCode(),
                channelType,
                request.agentName() != null ? request.agentName() : "이소연 선임 (본인)",
                request.title(),
                request.content(),
                request.hasAudio(),
                request.audioDuration(),
                request.tags()
        );

        return ResponseEntity.ok(timelineRepository.save(item));
    }
}
