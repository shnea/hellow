package kr.shnea.hellow.chat;

import static org.springframework.http.HttpStatus.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.queue.QueueItem;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Images use the same queue lock and sequence as text; file capabilities stay outside transcripts. */
@Service
public class ChatImageService {
  static final long MAX_BYTES=50*1024*1024;
  private final ChatService chat;private final ChatMessageRepository messages;
  private final PlatformClient platform;private final PlatformProperties properties;private final Clock clock;
  public ChatImageService(ChatService chat,ChatMessageRepository messages,PlatformClient platform,PlatformProperties properties,Clock clock){
    this.chat=chat;this.messages=messages;this.platform=platform;this.properties=properties;this.clock=clock;
  }
  @Transactional
  public ChatService.Message send(String session,String id,MultipartFile file)throws IOException{
    var q=chat.customer(session,true);
    try{id=UUID.fromString(id).toString();}catch(Exception e){throw new ResponseStatusException(BAD_REQUEST,"이미지 전송 ID가 올바르지 않습니다.");}
    String mime=validate(file),sha=sha256(file);
    var previous=messages.findByQueueIdAndSenderKeyAndClientMessageId(q.getId(),"CUSTOMER",id);
    if(previous.isPresent()){
      var m=previous.get();
      if(!sha.equals(m.getImageSha256())||!mime.equals(m.getImageMime())||!Objects.equals(file.getSize(),m.getImageSize()))
        throw new ResponseStatusException(CONFLICT,"같은 전송 ID의 이미지가 변경되었습니다.");
      return chat.view(m);
    }
    if(!chat.active(q))throw new ResponseStatusException(CONFLICT,"수락된 진행 중 채팅에서만 이미지를 전송할 수 있습니다.");
    if(messages.countByQueueIdAndImageFileIdIsNotNull(q.getId())>=20)throw new ResponseStatusException(CONFLICT,"한 대화에 이미지는 최대 20장까지 보낼 수 있습니다.");
    if(properties.getAttachmentRetentionCode().isBlank()||!properties.isConfigured())
      throw new ResponseStatusException(SERVICE_UNAVAILABLE,"이미지 저장 서비스가 아직 설정되지 않았습니다.");
    String request=UUID.nameUUIDFromBytes(("chat-image:"+q.getOrganizationId()+":"+q.getCode()+":CUSTOMER:"+id).getBytes(StandardCharsets.UTF_8)).toString();
    var result=platform.uploadFile(file,request);
    if(result.size()!=file.getSize()||!sha.equals(result.sha256()))throw new ResponseStatusException(BAD_GATEWAY,"저장된 이미지 확인에 실패했습니다. 같은 이미지로 다시 시도해 주세요.");
    var m=new ChatMessage(q,q.nextChatSequence(),"CUSTOMER","CUSTOMER","고객",id,"",clock.instant());
    m.attachImage(result.fileId(),name(file.getOriginalFilename(),mime),mime,result.size(),sha);
    return chat.view(messages.saveAndFlush(m));
  }
  @Transactional(readOnly=true)
  public Map<String,Object> customerView(String session,long sequence){return ticket(chat.customer(session,false),sequence);}
  @Transactional(readOnly=true)
  public Map<String,Object> staffView(WorkspaceAccess.Actor actor,String code,long sequence){return ticket(chat.staff(actor,code,false),sequence);}
  private Map<String,Object> ticket(QueueItem q,long sequence){
    var m=messages.findByQueueIdAndSequence(q.getId(),sequence).filter(row->row.getImageFileId()!=null).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    try{
      var raw=platform.getViewTicket(m.getImageFileId());var result=new LinkedHashMap<String,Object>();
      for(String key:List.of("originalUrl","previewUrl","thumbnailUrl"))if(raw.get(key) instanceof String url&&!url.isBlank())result.put(key,url);
      if(result.isEmpty())throw new IllegalStateException();return result;
    }catch(Exception e){throw new ResponseStatusException(BAD_GATEWAY,"이미지를 불러오지 못했습니다. 다시 불러와 주세요.");}
  }
  private String validate(MultipartFile file)throws IOException{
    if(file.isEmpty()||file.getSize()>MAX_BYTES)throw new ResponseStatusException(BAD_REQUEST,"JPG·PNG 이미지를 최대 50MB까지 보낼 수 있습니다.");
    try(var input=new MemoryCacheImageInputStream(file.getInputStream())){
      var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw new IOException();
      var reader=readers.next();try{
        String format=reader.getFormatName().toLowerCase(Locale.ROOT);
        if(!Set.of("jpeg","png").contains(format))throw new IOException();
        reader.setInput(input,true,true);int width=reader.getWidth(0),height=reader.getHeight(0);
        if(width<1||height<1||(long)width*height>16_000_000||reader.read(0)==null)throw new IOException();
        return format.equals("jpeg")?"image/jpeg":"image/png";
      }finally{reader.dispose();}
    }catch(IOException|RuntimeException e){throw new ResponseStatusException(BAD_REQUEST,"올바른 JPG·PNG 이미지여야 하며 최대 1600만 화소까지 보낼 수 있습니다.");}
  }
  private String sha256(MultipartFile file)throws IOException{
    try(var input=file.getInputStream()){
      var digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int count;
      while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);return HexFormat.of().formatHex(digest.digest());
    }catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
  }
  private String name(String original,String mime){
    String safe=original==null?"":original.replace('\\','/');safe=safe.substring(safe.lastIndexOf('/')+1).replaceAll("[\\p{Cntrl}]","").strip();
    return safe.isBlank()?"image."+(mime.equals("image/png")?"png":"jpg"):safe.substring(0,Math.min(safe.length(),180));
  }
}
