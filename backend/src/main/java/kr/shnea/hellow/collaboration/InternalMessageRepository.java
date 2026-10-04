package kr.shnea.hellow.collaboration;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InternalMessageRepository extends JpaRepository<InternalMessage, Long> {
  Optional<InternalMessage> findByRoomIdAndSenderIssuerAndSenderSubjectAndClientMessageId(
      String room, String issuer, String subject, String id);

  Slice<InternalMessage> findByRoomIdAndSequenceGreaterThanOrderBySequence(
      String room, long sequence, Pageable page);

  List<InternalMessage> findByRoomIdOrderBySequenceDesc(String room, Pageable page);

  @Query(
      "select count(m) from InternalMessage m where m.roomId=:room and m.sequence>:sequence"
          + " and (m.senderIssuer<>:issuer or m.senderSubject<>:subject)")
  long unreadInRoom(String room, long sequence, String issuer, String subject);

  @Query(
      "select count(m) from InternalMessage m, InternalRoom r, InternalRoomMember p"
          + " where m.roomId=r.id and p.roomId=r.id and r.organizationId=:org"
          + " and p.membershipId=:member and p.active=true and m.sequence>p.readSequence"
          + " and (m.senderIssuer<>:issuer or m.senderSubject<>:subject)")
  long unreadInOrganization(String org, Long member, String issuer, String subject);
}
