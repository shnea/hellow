package kr.shnea.hellow.recording;
import static org.springframework.http.HttpStatus.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.queue.QueueItemRepository;
import kr.shnea.hellow.consultation.ConsultationRepository;
import kr.shnea.hellow.platform.PlatformClient;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/recordings")
public class RecordingController {
  private final CallRecordingRepository recordings;private final WorkspaceAccess access;private final QueueItemRepository queues;private final ConsultationRepository consultations;private final PlatformClient platform;private final AuditEventRepository audit;
  public RecordingController(CallRecordingRepository recordings,WorkspaceAccess access,QueueItemRepository queues,ConsultationRepository consultations,PlatformClient platform,AuditEventRepository audit){this.recordings=recordings;this.access=access;this.queues=queues;this.consultations=consultations;this.platform=platform;this.audit=audit;}
  public record View(String id,String status,long durationSeconds,String errorCode,boolean canPlay,boolean canRetry){}
  @GetMapping("/queue/{code}")
  public ResponseEntity<Map<String,Object>> get(@PathVariable String code){
    var actor=access.require("consultation:read");requireConsultation(actor,code);
    var r=recordings.findByOrganizationIdAndQueueCode(actor.organizationId(),code);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(r.<Map<String,Object>>map(row->Map.of("recording",new View(row.getId(),row.getState().name(),row.getDurationSeconds(),row.getErrorCode(),actor.can("recording:read",row),actor.can("recording:manage",row)))).orElseGet(Map::of));
  }
  @PostMapping("/{id}/playback")
  public ResponseEntity<Map<String,Object>> playback(@PathVariable String id){return capability(id,"recording.playback");}
  @PostMapping("/{id}/download")
  public ResponseEntity<Map<String,Object>> download(@PathVariable String id){return capability(id,"recording.download");}
  private ResponseEntity<Map<String,Object>> capability(String id,String action){
    var actor=access.require("recording:read");var r=requireRecording(actor,id);requireConsultation(access.require("consultation:read"),r.getQueueCode());
    if(r.getState()!=CallRecording.State.READY||r.getFileId()==null)throw new ResponseStatusException(CONFLICT,"아직 재생할 수 있는 녹음이 없습니다.");
    var ticket=platform.getViewTicket(r.getFileId());audit.save(new AuditEvent(actor.organizationId(),actor.issuer(),actor.subject(),action,id,null));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ticket);
  }
  @PostMapping("/{id}/retry")
  public void retry(@PathVariable String id){var actor=access.require("recording:manage");var r=requireRecording(actor,id);requireConsultation(access.require("consultation:read"),r.getQueueCode());
    if(r.leased())throw new ResponseStatusException(CONFLICT,"녹음 저장을 처리 중입니다. 잠시 후 상태를 확인해 주세요.");
    if(r.getState()!=CallRecording.State.UPLOADING&&r.getState()!=CallRecording.State.STARTING&&r.getState()!=CallRecording.State.RECORDING)throw new ResponseStatusException(CONFLICT,"복구할 녹음 원본이 없습니다. 실패한 통화를 소급 녹음할 수는 없습니다.");
    r.retry();recordings.saveAndFlush(r);audit.save(new AuditEvent(actor.organizationId(),actor.issuer(),actor.subject(),"recording.retry",id,null));}
  private CallRecording requireRecording(WorkspaceAccess.Actor actor,String id){var r=recordings.findById(id).orElseThrow(()->new ResponseStatusException(NOT_FOUND));actor.requireRow(r);return r;}
  private void requireConsultation(WorkspaceAccess.Actor actor,String code){
    if(consultations.findByOrganizationIdAndQueueCode(actor.organizationId(),code).map(actor::allows).orElse(false))return;
    actor.requireRow(queues.findByOrganizationIdAndCode(actor.organizationId(),code).orElseThrow(()->new ResponseStatusException(NOT_FOUND)));
  }
}
