package kr.shnea.hellow.recording;

import static kr.shnea.hellow.recording.CallRecording.State.*;
import java.nio.file.*;
import java.time.Instant;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.livekit.LiveKitService;
import kr.shnea.hellow.platform.PlatformClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;

@Component @EnableScheduling
@ConditionalOnProperty(name="hellow.recording-enabled",havingValue="true")
public class RecordingWorker {
  private final CallRecordingRepository recordings;private final QueueItemRepository queues;
  private final EgressClient egress;private final LiveKitService media;private final PlatformClient files;private final Path directory;
  public RecordingWorker(CallRecordingRepository recordings,QueueItemRepository queues,EgressClient egress,LiveKitService media,PlatformClient files,@Value("${hellow.recording-directory:/recordings}")String directory){this.recordings=recordings;this.queues=queues;this.egress=egress;this.media=media;this.files=files;this.directory=Path.of(directory).toAbsolutePath().normalize();}
  @Bean(name="recordingScheduler") public static ThreadPoolTaskScheduler scheduler(){var s=new ThreadPoolTaskScheduler();s.setPoolSize(1);s.setThreadNamePrefix("recording-");return s;}
  @Bean(name="taskScheduler") public static ThreadPoolTaskScheduler businessScheduler(){var s=new ThreadPoolTaskScheduler();s.setPoolSize(1);s.setThreadNamePrefix("business-");return s;}
  @Scheduled(fixedDelay=2000,initialDelay=7000,scheduler="recordingScheduler")
  public void tick(){
    for(var q:queues.findByStatusAndCallEndedFalse(QueueItem.QueueStatus.PROCESSING))if(q.getType()==QueueItem.ItemType.CALL&&q.getOrganizationId()!=null&&recordings.findByOrganizationIdAndQueueCode(q.getOrganizationId(),q.getCode()).isEmpty()){
      try{recordings.saveAndFlush(new CallRecording(q));}catch(org.springframework.dao.DataIntegrityViolationException duplicate){/* Another worker inserted it. */}
    }
    for(String id:recordings.pending(Instant.now(),org.springframework.data.domain.PageRequest.of(0,20)))process(id);
  }
  public void process(String id){
    var now=Instant.now();if(recordings.claim(id,now,now.plusSeconds(600))!=1)return;
    var r=recordings.findById(id).orElseThrow();
    try{advance(r);}catch(Exception e){r.failure(r.getState()==UPLOADING?"FILE_UPLOAD_RETRY":"MEDIA_RETRY");org.slf4j.LoggerFactory.getLogger(getClass()).warn("Recording {} will retry ({})",id,e.getClass().getSimpleName());}
    finally{r.release();save(r);}
  }
  private void save(CallRecording r){r.revision(recordings.saveAndFlush(r).revision());}
  private void advance(CallRecording r)throws java.io.IOException {
    var q=queues.findByOrganizationIdAndCode(r.getOrganizationId(),r.getQueueCode()).orElseThrow();
    String room=r.getOrganizationId()+"-"+r.getQueueCode();Path path=directory.resolve(r.getId()+".ogg");
    if(r.getState()==UPLOADING){if(!Files.isRegularFile(path)||Files.size(path)==0)throw new java.io.IOException("Recording file unavailable");var uploaded=files.uploadFile(path,r.getId());r.ready(uploaded.fileId());save(r);Files.deleteIfExists(path);return;}
    if(r.getState()==PENDING){
      if(q.isCallEnded()){r.transition(NO_AUDIO);return;}
      var agent=media.participantConnection(room,q.getMediaAgentIdentity());var customer=media.participantConnection(room,"customer-"+q.getCode());
      if(!agent.active()||!customer.active()||!agent.microphonePublished()||!customer.microphonePublished())return;
      r.transition(STARTING);save(r);
    }
    com.fasterxml.jackson.databind.JsonNode info=null;
    for(var item:egress.list(room))if(r.getEgressId()==null||r.getEgressId().equals(item.path("egress_id").asText())){info=item;break;}
    if(info==null){
      if(r.getEgressId()!=null){r.failure("MEDIA_RESULT_UNAVAILABLE");return;}
      if(q.isCallEnded()){r.transition(NO_AUDIO);return;}
      // STARTING is persisted before the network call; retry recovers a lost response via ListEgress.
      info=egress.start(room,path.toString());
    }
    if(r.getEgressId()==null){r.started(info.path("egress_id").asText());save(r);}
    String state=info.path("status").asText("EGRESS_STARTING");
    if(state.equals("EGRESS_COMPLETE")||state.equals("3")||state.equals("EGRESS_LIMIT_REACHED")||state.equals("6")){
      var output=info.path("file_results").path(0);r.uploading(output.path("duration").asLong()/1_000_000_000L);return;
    }
    if(state.equals("EGRESS_FAILED")||state.equals("4")||state.equals("EGRESS_ABORTED")||state.equals("5")){r.transition(FAILED);r.failure("CAPTURE_FAILED");return;}
    if(q.isCallEnded()&&!state.equals("EGRESS_ENDING")&&!state.equals("2"))egress.stop(r.getEgressId());
  }
}
