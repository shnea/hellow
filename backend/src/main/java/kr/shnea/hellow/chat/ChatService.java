package kr.shnea.hellow.chat;

import static org.springframework.http.HttpStatus.*;
import java.time.*;
import java.util.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Queue is the one-to-one conversation aggregate; its lock serializes send, end and handoff. */
@Service
public class ChatService {
  private final QueueItemRepository queues;
  private final ChatMessageRepository messages;
  private final OrganizationRepository organizations;
  private final Clock clock;
  public ChatService(QueueItemRepository queues,ChatMessageRepository messages,OrganizationRepository organizations,Clock clock){
    this.queues=queues;this.messages=messages;this.organizations=organizations;this.clock=clock;
  }
  public record Message(long sequence,String sender,String senderName,String clientMessageId,String body,Instant createdAt){}
  public record View(String queueCode,String state,Instant endedAt,boolean canSend,List<Message> messages,long cursor,boolean hasMore){}
  private Message view(ChatMessage m){return new Message(m.getSequence(),m.getSender(),m.getSenderName(),m.getClientMessageId(),m.getBody(),m.getCreatedAt());}
  @Transactional
  public void initialize(QueueItem queue,String body){
    queue.enableChat();
    messages.save(new ChatMessage(queue,queue.nextChatSequence(),"CUSTOMER","CUSTOMER","고객","initial",body,clock.instant()));
  }
  private boolean closed(QueueItem q){return q.getChatEndedAt()!=null||q.supportExpired(clock.instant())||q.getStatus()==QueueItem.QueueStatus.COMPLETED||q.getStatus()==QueueItem.QueueStatus.CANCELLED;}
  private boolean active(QueueItem q){return !closed(q)&&q.getStatus()==QueueItem.QueueStatus.PROCESSING;}
  private void chat(QueueItem q){if(!q.isChatEnabled())throw new ResponseStatusException(NOT_FOUND,"실시간 대화가 없는 접수입니다.");}
  private QueueItem customer(String session,boolean lock){
    if(session==null||session.isBlank())throw new ResponseStatusException(NOT_FOUND);
    var q=(lock?queues.lockSession(session):queues.findBySessionId(session)).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    chat(q);
    if(!organizations.findById(q.getOrganizationId()).map(Organization::isActive).orElse(false))throw new ResponseStatusException(NOT_FOUND);
    if(q.supportExpired(clock.instant()))throw new ResponseStatusException(GONE,"채팅 세션이 만료되었습니다.");
    return q;
  }
  private QueueItem staff(WorkspaceAccess.Actor actor,String code,boolean lock){
    var q=(lock?queues.lockByCode(actor.organizationId(),code):queues.findByOrganizationIdAndCode(actor.organizationId(),code)).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    actor.requireRow(q);chat(q);return q;
  }
  private boolean owns(WorkspaceAccess.Actor a,QueueItem q){return Objects.equals(a.issuer(),q.getOwnerIssuer())&&Objects.equals(a.subject(),q.getAssignedSubject());}
  private View read(QueueItem q,long after,boolean writable){
    if(after<0||after>q.getChatSequence())throw new ResponseStatusException(BAD_REQUEST,"잘못된 메시지 위치입니다.");
    var rows=messages.findByQueueIdAndSequenceGreaterThanOrderBySequenceAsc(q.getId(),after,org.springframework.data.domain.PageRequest.of(0,100));
    long cursor=rows.isEmpty()?after:rows.getLast().getSequence();
    return new View(q.getCode(),closed(q)?"CLOSED":q.getStatus()==QueueItem.QueueStatus.WAITING?"WAITING":"OPEN",q.getChatEndedAt(),writable&&active(q),rows.stream().map(this::view).toList(),cursor,cursor<q.getChatSequence());
  }
  @Transactional(readOnly=true)
  public View customerRead(String session,long after){return read(customer(session,false),after,true);}
  @Transactional(readOnly=true)
  public View staffRead(WorkspaceAccess.Actor actor,String code,long after){var q=staff(actor,code,false);return read(q,after,owns(actor,q)&&actor.can("queue:accept",q));}
  private Message send(QueueItem q,String key,String sender,String name,String id,String body){
    try{id=UUID.fromString(id).toString();}catch(Exception e){throw new ResponseStatusException(BAD_REQUEST,"메시지 ID가 올바르지 않습니다.");}
    if(body==null||body.isBlank()||body.length()>10000)throw new ResponseStatusException(BAD_REQUEST,"메시지는 1~10000자여야 합니다.");
    var previous=messages.findByQueueIdAndSenderKeyAndClientMessageId(q.getId(),key,id);
    if(previous.isPresent()){
      if(!previous.get().getBody().equals(body))throw new ResponseStatusException(CONFLICT,"같은 메시지 ID의 내용이 변경되었습니다.");
      return view(previous.get());
    }
    if(!active(q))throw new ResponseStatusException(CONFLICT,"수락된 진행 중 채팅에서만 전송할 수 있습니다.");
    return view(messages.saveAndFlush(new ChatMessage(q,q.nextChatSequence(),key,sender,name,id,body,clock.instant())));
  }
  @Transactional
  public Message customerSend(String session,String id,String body){return send(customer(session,true),"CUSTOMER","CUSTOMER","고객",id,body);}
  @Transactional
  public Message staffSend(WorkspaceAccess.Actor actor,String code,String id,String body){
    var q=staff(actor,code,true);
    if(!owns(actor,q))throw new ResponseStatusException(CONFLICT,"현재 담당 상담사만 전송할 수 있습니다.");
    // Length-prefixed issuer keeps the identity tuple unambiguous even when subject contains ':'.
    return send(q,actor.issuer().length()+":"+actor.issuer()+actor.subject(),"AGENT",actor.name(),id,body);
  }
  @Transactional
  public View customerEnd(String session){var q=customer(session,true);return end(q);}
  @Transactional
  public View staffEnd(WorkspaceAccess.Actor actor,String code){var q=staff(actor,code,true);if(!owns(actor,q))throw new ResponseStatusException(CONFLICT);return end(q);}
  private View end(QueueItem q){
    if(!closed(q)&&q.getStatus()!=QueueItem.QueueStatus.PROCESSING)throw new ResponseStatusException(CONFLICT,"대기 중 요청은 접수 취소를 이용해 주세요.");
    q.endChat(clock.instant());return read(q,q.getChatSequence(),false);
  }
}
