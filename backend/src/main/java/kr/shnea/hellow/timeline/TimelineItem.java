package kr.shnea.hellow.timeline;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "timeline_items")
public class TimelineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String customerCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ChannelType channel;

    @Column(nullable = false, length = 100)
    private String agentName;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    private boolean hasAudio;

    @Column(length = 32)
    private String audioDuration;

    @Column(length = 255)
    private String tags;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public enum ChannelType {
        CALL, EMAIL, CHAT, TICKET
    }

    protected TimelineItem() {}

    public TimelineItem(String customerCode, ChannelType channel, String agentName,
                        String title, String content, boolean hasAudio,
                        String audioDuration, String tags) {
        this.customerCode = customerCode;
        this.channel = channel;
        this.agentName = agentName;
        this.title = title;
        this.content = content;
        this.hasAudio = hasAudio;
        this.audioDuration = audioDuration;
        this.tags = tags;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getCustomerCode() { return customerCode; }
    public ChannelType getChannel() { return channel; }
    public String getAgentName() { return agentName; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public boolean isHasAudio() { return hasAudio; }
    public String getAudioDuration() { return audioDuration; }
    public String getTags() { return tags; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
