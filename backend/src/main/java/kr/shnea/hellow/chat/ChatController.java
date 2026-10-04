package kr.shnea.hellow.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Clock;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class ChatController {
  private final ChatService chat;private final ChatStreams streams;private final WorkspaceAccess access;private final Clock clock;
  public ChatController(ChatService chat,ChatStreams streams,WorkspaceAccess access,Clock clock){this.chat=chat;this.streams=streams;this.access=access;this.clock=clock;}
  @ModelAttribute
  public void responseHeaders(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");response.setHeader("X-Accel-Buffering","no");}
  public record Send(@NotBlank @Pattern(regexp="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}") String clientMessageId,@NotBlank @Size(max=10000) String body){}
  @GetMapping("/api/support/chat/messages")
  public ChatService.View customerRead(@RequestHeader("X-Support-Session") String session,@RequestParam(defaultValue="0") long afterSequence){return chat.customerRead(session,afterSequence);}
  @PostMapping("/api/support/chat/messages")
  public ChatService.Message customerSend(@RequestHeader("X-Support-Session") String session,@Valid @RequestBody Send r){return chat.customerSend(session,r.clientMessageId(),r.body());}
  @PostMapping("/api/support/chat/end")
  public ChatService.View customerEnd(@RequestHeader("X-Support-Session") String session){return chat.customerEnd(session);}
  @GetMapping(value="/api/support/chat/events",produces="text/event-stream")
  public SseEmitter customerEvents(@RequestHeader("X-Support-Session") String session,@RequestParam(defaultValue="0") long afterSequence){return streams.open("customer:"+session,afterSequence,after->chat.customerRead(session,after));}
  @GetMapping("/api/chat/{code}/messages")
  public ChatService.View staffRead(@PathVariable String code,@RequestParam(defaultValue="0") long afterSequence,@RequestParam(defaultValue="false") boolean history){return chat.staffRead(access.require(history?"consultation:read":"queue:read"),code,afterSequence);}
  @PostMapping("/api/chat/{code}/messages")
  public ChatService.Message staffSend(@PathVariable String code,@Valid @RequestBody Send r){return chat.staffSend(access.require("queue:accept"),code,r.clientMessageId(),r.body());}
  @PostMapping("/api/chat/{code}/end")
  public ChatService.View staffEnd(@PathVariable String code){return chat.staffEnd(access.require("queue:accept"),code);}
  @GetMapping(value="/api/chat/{code}/events",produces="text/event-stream")
  public SseEmitter staffEvents(@PathVariable String code,@RequestParam(defaultValue="0") long afterSequence){
    var jwt=access.identity();var organizationId=access.organizationId();
    return streams.open("staff:"+organizationId+":"+jwt.getIssuer()+":"+jwt.getSubject(),afterSequence,after->{
      if(jwt.getExpiresAt()!=null&&!jwt.getExpiresAt().isAfter(clock.instant()))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED);
      return chat.staffRead(access.require(organizationId,jwt,"queue:read"),code,after);
    });
  }
}
