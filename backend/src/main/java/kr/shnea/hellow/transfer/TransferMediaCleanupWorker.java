package kr.shnea.hellow.transfer;

import java.time.Clock;
import kr.shnea.hellow.livekit.LiveKitService;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

/** Removes the participant released by a completed or failed handoff. */
@Component @EnableScheduling
@ConditionalOnProperty(name="hellow.media-cleanup-enabled",havingValue="true",matchIfMissing=true)
public class TransferMediaCleanupWorker {
  private final WorkTransferRepository requests;
  private final LiveKitService media;private final Clock clock;
  public TransferMediaCleanupWorker(WorkTransferRepository requests,LiveKitService media,Clock clock){this.requests=requests;this.media=media;this.clock=clock;}
  @Scheduled(fixedDelay=2000)
  public void cleanup(){
    for(var t:requests.callCleanupPending()) {
      String identity=t.getStatus()==WorkTransfer.Status.ACCEPTED?t.getFromMediaIdentity():t.getTargetMediaIdentity();
      try{media.removeParticipant(t.getOrganizationId()+"-"+t.getQueueCode(),identity);t.cleanupSucceeded(clock.instant());requests.save(t);}
      catch(Exception error){LoggerFactory.getLogger(getClass()).warn("Call transfer media cleanup pending for request {}",t.getId());}
    }
  }
}
