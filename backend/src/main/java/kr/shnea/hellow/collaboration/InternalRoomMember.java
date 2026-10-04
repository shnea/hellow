package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "internal_room_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"roomId", "membershipId"}))
public class InternalRoomMember {
  @Id String id;

  @Column(nullable = false, length = 64)
  String roomId;

  @Column(nullable = false)
  Long membershipId;

  @Column(nullable = false)
  boolean active;

  @Column(nullable = false)
  long readSequence;

  @Column(nullable = false)
  Instant joinedAt;

  Instant leftAt;

  protected InternalRoomMember() {}
}
