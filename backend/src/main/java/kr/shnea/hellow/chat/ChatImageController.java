package kr.shnea.hellow.chat;

import java.io.IOException;
import java.util.Map;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ChatImageController {
  private final ChatImageService images;private final WorkspaceAccess access;
  public ChatImageController(ChatImageService images,WorkspaceAccess access){this.images=images;this.access=access;}
  @ModelAttribute public void headers(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");}
  @PostMapping(value="/api/support/chat/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  public ChatService.Message send(@RequestHeader("X-Support-Session") String session,@RequestParam String clientMessageId,@RequestParam MultipartFile file)throws IOException{return images.send(session,clientMessageId,file);}
  @GetMapping("/api/support/chat/images/{sequence}/views")
  public Map<String,Object> customerView(@RequestHeader("X-Support-Session") String session,@PathVariable long sequence){return images.customerView(session,sequence);}
  @GetMapping("/api/chat/{code}/images/{sequence}/views")
  public Map<String,Object> staffView(@PathVariable String code,@PathVariable long sequence,@RequestParam(defaultValue="false") boolean history){return images.staffView(access.require(history?"consultation:read":"queue:read"),code,sequence);}
}
