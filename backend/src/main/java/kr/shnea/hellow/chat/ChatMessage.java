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
  private String imageFileId;
  private String imageName;
  @Column(length=32) private String imageMime;
  private Long imageSize;
  @Column(length=64) private String imageSha256;
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
  public void attachImage(String fileId,String name,String mime,long size,String sha256){
    imageFileId=fileId;imageName=name;imageMime=mime;imageSize=size;imageSha256=sha256;
  }
  public String getImageFileId(){return imageFileId;}
  public String getImageName(){return imageName;}
  public String getImageMime(){return imageMime;}
  public Long getImageSize(){return imageSize;}
  public String getImageSha256(){return imageSha256;}
}
