package kr.shnea.hellow.support;
import java.time.Clock;
import kr.shnea.hellow.queue.QueueItemRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name="hellow.support-cleanup-enabled",havingValue="true",matchIfMissing=true)
public class SupportExpiryWorker {
  private final QueueItemRepository queues;private final SupportExpiryService expiry;private final Clock clock;
  public SupportExpiryWorker(QueueItemRepository queues,SupportExpiryService expiry,Clock clock){this.queues=queues;this.expiry=expiry;this.clock=clock;}
  @Scheduled(fixedDelay=10000,initialDelay=5000)
  public void cleanup(){for(var q:queues.expiredSupportWork(clock.instant()))try{expiry.expire(q.getOrganizationId(),q.getCode());}
    catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Customer session expiry pending for queue {}",q.getCode());}}
}
