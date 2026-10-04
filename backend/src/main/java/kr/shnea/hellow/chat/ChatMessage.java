package kr.shnea.hellow.chat;

import jakarta.persistence.*;
import java.time.Instant;
import kr.shnea.hellow.queue.QueueItem;

@Entity
@Table(name="chat_messages",uniqueConstraints={
    @UniqueConstraint(columnNames={"queue_id","sequence"}),
    @UniqueConstraint(columnNames={"queue_id","sender_key","client_message_id"})})
public class ChatMessage {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="queue_id")
  @org.hibernate.annotations.OnDelete(action=org.hibernate.annotations.OnDeleteAction.CASCADE)
  private QueueItem queue;
  @Column(nullable=false) private long sequence;
  @Column(nullable=false,length=600) private String senderKey;
  @Column(nullable=false,length=16) private String sender;
  @Column(nullable=false,columnDefinition="TEXT") private String senderName;
  @Column(nullable=false,length=36) private String clientMessageId;
  @Column(nullable=false,columnDefinition="TEXT") private String body;
  @Column(nullable=false) private Instant createdAt;
  protected ChatMessage(){}
  public ChatMessage(QueueItem queue,long sequence,String senderKey,String sender,String senderName,String clientMessageId,String body,Instant now){
    this.queue=queue;this.sequence=sequence;this.senderKey=senderKey;this.sender=sender;
    this.senderName=senderName;this.clientMessageId=clientMessageId;this.body=body;this.createdAt=now;
  }
  public long getSequence(){return sequence;}
  public String getSender(){return sender;}
  public String getSenderName(){return senderName;}
  public String getClientMessageId(){return clientMessageId;}
  public String getBody(){return body;}
  public Instant getCreatedAt(){return createdAt;}
}
