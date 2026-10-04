package kr.shnea.hellow.collaboration;

import java.time.Clock;
import java.util.*;
import kr.shnea.hellow.chat.ChatStreams;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/internal-chat")
public class InternalChatController {
  private final InternalChatService service;
  private final WorkspaceAccess access;
  private final ChatStreams streams;
  private final Clock clock;

  public InternalChatController(
      InternalChatService service, WorkspaceAccess access, ChatStreams streams, Clock clock) {
    this.service = service;
    this.access = access;
    this.streams = streams;
    this.clock = clock;
  }

  @ModelAttribute
  public void headers(jakarta.servlet.http.HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Accel-Buffering", "no");
  }

  @GetMapping("/candidates")
  public List<InternalChatService.Candidate> candidates() {
    return service.candidates();
  }

  @GetMapping("/rooms")
  public InternalChatService.RoomPage rooms(@RequestParam(defaultValue = "0") int page) {
    return service.list(page);
  }

  @PostMapping("/rooms")
  public InternalChatService.RoomView create(@RequestBody InternalChatService.Create r) {
    return service.create(r);
  }

  @GetMapping("/rooms/{id}/messages")
  public InternalChatService.Conversation read(
      @PathVariable String id, @RequestParam(defaultValue = "0") long afterSequence) {
    return service.read(access.require("internal-chat:read"), id, afterSequence);
  }

  @PostMapping("/rooms/{id}/messages")
  public InternalChatService.Message send(
      @PathVariable String id, @RequestBody InternalChatService.Send r) {
    return service.send(id, r);
  }

  public record Read(long sequence) {}

  public record Version(long expectedVersion) {}

  @PostMapping("/rooms/{id}/read")
  public InternalChatService.RoomView markRead(@PathVariable String id, @RequestBody Read r) {
    return service.markRead(id, r.sequence());
  }

  public record Manage(long expectedVersion, String name, List<Long> add, List<Long> remove) {}

  @PutMapping("/rooms/{id}")
  public InternalChatService.RoomView manage(@PathVariable String id, @RequestBody Manage r) {
    return service.manage(id, r.expectedVersion(), r.name(), r.add(), r.remove());
  }

  @PostMapping("/rooms/{id}/leave")
  public void leave(@PathVariable String id, @RequestBody Version r) {
    service.leave(id, r.expectedVersion());
  }

  @PostMapping(value = "/rooms/{id}/files", consumes = "multipart/form-data")
  public WorkFiles.View upload(
      @PathVariable String id, @RequestParam String requestId, @RequestParam MultipartFile file)
      throws java.io.IOException {
    return service.upload(id, requestId, file);
  }

  @GetMapping("/rooms/{id}/files/{file}/views")
  public Map<String, Object> ticket(@PathVariable String id, @PathVariable String file) {
    return service.ticket(id, file);
  }

  @GetMapping(value = "/rooms/{id}/events", produces = "text/event-stream")
  public SseEmitter events(
      @PathVariable String id, @RequestParam(defaultValue = "0") long afterSequence) {
    var jwt = access.identity();
    var organizationId = access.organizationId();
    return streams.openFrames(
        "internal:" + organizationId + ":" + jwt.getIssuer() + ":" + jwt.getSubject(),
        afterSequence,
        after -> {
          if (jwt.getExpiresAt() != null && !jwt.getExpiresAt().isAfter(clock.instant()))
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.UNAUTHORIZED);
          var data =
              service.read(access.require(organizationId, jwt, "internal-chat:read"), id, after);
          return new ChatStreams.Frame(data, data.cursor(), false, data.hasMore());
        });
  }
}
