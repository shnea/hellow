package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "internal_messages",
    uniqueConstraints = {
      @UniqueConstraint(columnNames = {"roomId", "sequence"}),
      @UniqueConstraint(
          columnNames = {"roomId", "senderIssuer", "senderSubject", "clientMessageId"})
    })
public class InternalMessage {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @Column(nullable = false, length = 64)
  String roomId;

  @Column(nullable = false)
  long sequence;

  @Column(nullable = false, length = 255)
  String senderIssuer, senderSubject, senderName;

  @Column(nullable = false, length = 36)
  String clientMessageId;

  @Column(nullable = false, columnDefinition = "text")
  String body, attachmentIds;

  @Column(nullable = false)
  Instant createdAt;

  protected InternalMessage() {}
}
