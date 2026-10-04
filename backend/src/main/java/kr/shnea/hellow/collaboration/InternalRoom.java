package kr.shnea.hellow.collaboration;

import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.security.OrganizationOwned;

@Entity
@Table(
    name = "internal_rooms",
    uniqueConstraints = @UniqueConstraint(columnNames = {"organizationId", "creationKey"}))
public class InternalRoom extends OrganizationOwned {
  @Id String id;
  @Version long version;

  @Column(nullable = false, length = 16)
  String kind;

  @Column(nullable = false, length = 150)
  String name;

  @Column(nullable = false, length = 64)
  String creationKey;

  @Column(nullable = false)
  Long creatorMemberId;

  @Column(nullable = false)
  long sequence;

  @Column(nullable = false)
  Instant createdAt, updatedAt;

  protected InternalRoom() {}
}
