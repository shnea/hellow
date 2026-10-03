package kr.shnea.hellow.followup;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/followup") @Validated
public class FollowUpController {
  private final FollowUpService service;
  public FollowUpController(FollowUpService service){this.service=service;}
  public record Request(@NotBlank @Size(max=64) String queueCode,
      @NotBlank @Pattern(regexp="VISIT|CALLBACK") String actionType,
      @NotBlank @Size(max=200) String title,@NotBlank @Size(max=10000) String details,
      @Pattern(regexp="(?i)[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}") String requestId,
      Instant proposedAt,@Size(max=100) String timeZone){}
  public record Edit(@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=200) String title,
      @NotBlank @Size(max=10000) String details,@NotBlank @Size(max=2000) String reason){}
  public record Schedule(@NotNull @Min(0) Long expectedVersion,@NotNull Instant scheduledAt,
      @NotNull @Min(5) @Max(480) Integer durationMinutes,@NotBlank @Size(max=100) String timeZone,
      @NotNull @Positive Long assignedMemberId,@NotBlank @Size(max=2000) String reason){}
  public record Transition(@NotNull @Min(0) Long expectedVersion,
      @NotBlank @Pattern(regexp="IN_PROGRESS|COMPLETED|FAILED|CANCELLED") String status,
      @NotBlank @Size(max=2000) String reason){}
  @PostMapping public FollowUpService.View create(@Valid @RequestBody Request r){return service.create(r);}
  @GetMapping public FollowUpService.Page list(@RequestParam(required=false) @Size(max=64) String queueCode,
      @RequestParam(required=false) @Size(max=64) String customerCode,@RequestParam(required=false) @Pattern(regexp="VISIT|CALLBACK") String actionType,
      @RequestParam(required=false) @Pattern(regexp="PENDING|SCHEDULED|IN_PROGRESS|COMPLETED|FAILED|CANCELLED") String status,
      @RequestParam(required=false) Instant from,@RequestParam(required=false) Instant until,
      @RequestParam(defaultValue="0") @Min(0) @Max(100000) int page){return service.list(queueCode,customerCode,actionType,status,from,until,page);}
  @GetMapping("/{id}") public FollowUpService.View get(@PathVariable Long id){return service.get(id);}
  @GetMapping("/{id}/history") public List<FollowUpService.EventView> history(@PathVariable Long id,@RequestParam(defaultValue="0") @Min(0) @Max(100000) int page){return service.history(id,page);}
  @GetMapping("/assignees") public List<FollowUpService.Assignee> assignees(){return service.assignees();}
  @GetMapping("/active") public FollowUpService.Active active(){return service.active();}
  @GetMapping("/request/{requestId}") public FollowUpService.View requested(@PathVariable String requestId){return service.requested(requestId);}
  @PutMapping("/{id}") public FollowUpService.View edit(@PathVariable Long id,@Valid @RequestBody Edit r){return service.edit(id,r);}
  @PostMapping("/{id}/schedule") public FollowUpService.View schedule(@PathVariable Long id,@Valid @RequestBody Schedule r){return service.schedule(id,r);}
  @PostMapping("/{id}/status") public FollowUpService.View transition(@PathVariable Long id,@Valid @RequestBody Transition r){return service.transition(id,r);}
}
