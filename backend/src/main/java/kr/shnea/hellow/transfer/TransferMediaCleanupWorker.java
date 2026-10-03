package kr.shnea.hellow.transfer;

import java.time.Clock;
import kr.shnea.hellow.livekit.LiveKitService;
import kr.shnea.hellow.queue.*;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

/** Ended calls keep every former agent revocable after after-call ownership changes. */
@Component @EnableScheduling
@ConditionalOnProperty(name="hellow.media-cleanup-enabled",havingValue="true",matchIfMissing=true)
public class TransferMediaCleanupWorker {
  private final QueueItemRepository queues;private final WorkTransferRepository requests;
  private final LiveKitService media;private final Clock clock;
  public TransferMediaCleanupWorker(QueueItemRepository queues,WorkTransferRepository requests,LiveKitService media,Clock clock){this.queues=queues;this.requests=requests;this.media=media;this.clock=clock;}
  @Scheduled(fixedDelay=2000)
  public void cleanup(){
    for(var q:queues.findByCallEndedTrueAndMediaCleanupUntilAfter(clock.instant())){
      if(q.getType()!=QueueItem.ItemType.CALL||q.getOrganizationId()==null)continue;
      for(var subject:requests.findByOrganizationIdAndQueueCodeAndStatus(q.getOrganizationId(),q.getCode(),WorkTransfer.Status.ACCEPTED).stream().map(WorkTransfer::getFromSubject).distinct().toList())
        try{media.removeParticipant(q.getOrganizationId()+"-"+q.getCode(),"agent-"+subject);}
        catch(Exception error){LoggerFactory.getLogger(getClass()).warn("Former agent media cleanup pending for queue {}",q.getCode());}
    }
  }
}
