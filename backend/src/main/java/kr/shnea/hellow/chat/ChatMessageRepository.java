package kr.shnea.hellow.chat;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChatMessageRepository extends JpaRepository<ChatMessage,Long> {
  List<ChatMessage> findByQueueIdAndSequenceGreaterThanOrderBySequenceAsc(Long queueId,long sequence,Pageable page);
  Optional<ChatMessage> findByQueueIdAndSenderKeyAndClientMessageId(Long queueId,String senderKey,String clientMessageId);
  Optional<ChatMessage> findByQueueIdAndSequence(Long queueId,long sequence);
  long countByQueueIdAndImageFileIdIsNotNull(Long queueId);
}
