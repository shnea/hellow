package kr.shnea.hellow.transfer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/transfers")
public class WorkTransferController {
  private final WorkTransferService service;
  public WorkTransferController(WorkTransferService service){this.service=service;}
  public record Request(@NotNull Long consultationId,@NotNull @Min(0) Long expectedRecordVersion,@NotNull Long toMemberId,
      @NotBlank @Size(max=2000) String reason,@NotNull @Size(max=10000) String memo,
      @NotBlank @Pattern(regexp="(?i)[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}") String requestId){}
  public record Command(@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=2000) String reason){}
  @PostMapping("/work") public WorkTransferService.View create(@Valid @RequestBody Request request){return service.create(request);}
  @GetMapping public WorkTransferService.Page list(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) WorkTransfer.Status status,
      @RequestParam(defaultValue="ALL") WorkTransferService.Direction direction){return service.list(page,status,direction);}
  @GetMapping("/request/{requestId}") public WorkTransferService.View requested(@PathVariable String requestId){return service.requested(requestId);}
  @GetMapping("/assignees") public java.util.List<WorkTransferService.Assignee> assignees(@RequestParam Long consultationId){return service.assignees(consultationId);}
  @GetMapping("/{id}") public WorkTransferService.View get(@PathVariable String id){return service.get(id);}
  @GetMapping("/{id}/history") public java.util.List<WorkTransferService.EventView> history(@PathVariable String id,@RequestParam(defaultValue="0") int page){return service.history(id,page);}
  @PostMapping("/{id}/accept") public WorkTransferService.View accept(@PathVariable String id,@Valid @RequestBody Command c){return service.command(id,c,WorkTransfer.Status.ACCEPTED);}
  @PostMapping("/{id}/reject") public WorkTransferService.View reject(@PathVariable String id,@Valid @RequestBody Command c){return service.command(id,c,WorkTransfer.Status.REJECTED);}
  @PostMapping("/{id}/cancel") public WorkTransferService.View cancel(@PathVariable String id,@Valid @RequestBody Command c){return service.command(id,c,WorkTransfer.Status.CANCELLED);}
}
