package kr.shnea.hellow.collaboration;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InternalRoomMemberRepository extends JpaRepository<InternalRoomMember, String> {
  Optional<InternalRoomMember> findByRoomIdAndMembershipId(String room, Long member);

  List<InternalRoomMember> findByRoomIdOrderByJoinedAt(String room);
}
