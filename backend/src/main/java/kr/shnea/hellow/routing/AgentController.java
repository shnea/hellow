package kr.shnea.hellow.routing;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/agents/me")
public class AgentController {
  private final WorkspaceAccess access;private final RoutingService routing;
  public AgentController(WorkspaceAccess access,RoutingService routing){this.access=access;this.routing=routing;}
  public record Heartbeat(@Size(max=64) String receivedAttemptId){}
  public record Change(@NotNull AgentPresence.Availability state,@NotNull @Min(0) Long expectedVersion){}
  @GetMapping public RoutingService.AgentView current(){return routing.current(access.require("queue:accept"));}
  @PostMapping("/heartbeat") public RoutingService.AgentView heartbeat(@RequestBody(required=false) @Valid Heartbeat request){return routing.heartbeat(access.require("queue:accept"),request==null?null:request.receivedAttemptId());}
  @PutMapping("/status") public RoutingService.AgentView change(@RequestBody @Valid Change request){return routing.change(access.require("queue:accept"),request.state(),request.expectedVersion());}
}
