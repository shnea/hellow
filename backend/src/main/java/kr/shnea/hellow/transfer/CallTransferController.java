package kr.shnea.hellow.transfer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/transfers")
public class CallTransferController {
  private final WorkTransferService service;
  public CallTransferController(WorkTransferService service){this.service=service;}
  public record Connection(@NotNull @Min(0) Long expectedVersion){}
  @PostMapping("/call") public WorkTransferService.View create(@Valid @RequestBody WorkTransferController.Request request){return service.createCall(request);}
  @GetMapping("/call-assignees") public java.util.List<WorkTransferService.Assignee> assignees(@RequestParam Long consultationId){return service.callAssignees(consultationId);}
  @PostMapping("/{id}/media-token") public WorkTransferService.CallMediaResponse token(@PathVariable String id,@Valid @RequestBody Connection request){return service.callToken(id,request.expectedVersion());}
  @PostMapping("/{id}/confirm-media") public WorkTransferService.View confirm(@PathVariable String id,@Valid @RequestBody Connection request){return service.confirmCall(id,request.expectedVersion());}
}
