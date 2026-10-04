package kr.shnea.hellow.collaboration;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InternalMessageRepository extends JpaRepository<InternalMessage, Long> {
  Optional<InternalMessage> findByRoomIdAndSenderIssuerAndSenderSubjectAndClientMessageId(
      String room, String issuer, String subject, String id);

  Slice<InternalMessage> findByRoomIdAndSequenceGreaterThanOrderBySequence(
      String room, long sequence, Pageable page);

  List<InternalMessage> findByRoomIdOrderBySequenceDesc(String room, Pageable page);

  long countByRoomIdAndSequenceGreaterThan(String room, long sequence);
}
