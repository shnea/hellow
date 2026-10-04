package kr.shnea.hellow.collaboration;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface InternalRoomRepository extends JpaRepository<InternalRoom, String> {
  Optional<InternalRoom> findByOrganizationIdAndId(String org, String id);

  Optional<InternalRoom> findByOrganizationIdAndCreationKey(String org, String key);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from InternalRoom r where r.organizationId=:org and r.id=:id")
  Optional<InternalRoom> lock(String org, String id);

  @Query(
      "select r from InternalRoom r join InternalRoomMember p on p.roomId=r.id where"
          + " r.organizationId=:org and p.membershipId=:member and p.active=true order by"
          + " r.updatedAt desc,r.id")
  Slice<InternalRoom> rooms(String org, Long member, Pageable page);
}
