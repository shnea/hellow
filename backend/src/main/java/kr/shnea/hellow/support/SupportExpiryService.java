package kr.shnea.hellow.support;
import java.time.Clock;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportExpiryService {
  private final QueueItemRepository queues;private final OrganizationRepository organizations;private final Clock clock;
  public SupportExpiryService(QueueItemRepository queues,OrganizationRepository organizations,Clock clock){this.queues=queues;this.organizations=organizations;this.clock=clock;}
  @Transactional
  public void expire(String organizationId,String code){
    // Same organization -> queue lock order as routing; never call the routing lock from here.
    if(organizations.lockById(organizationId).isEmpty())return;
    queues.lockByCode(organizationId,code).ifPresent(q->{
      if(!q.supportExpired(clock.instant()))return;
      if(q.getStatus()==QueueItem.QueueStatus.WAITING)q.cancel();
      else if(q.getStatus()==QueueItem.QueueStatus.PROCESSING&&q.getType()==QueueItem.ItemType.CALL)q.endCall();
      // Accepted tickets and saved records remain staff work after customer access expires.
    });
  }
}
