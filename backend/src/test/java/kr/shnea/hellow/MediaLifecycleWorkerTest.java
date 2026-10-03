package kr.shnea.hellow;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.*;
import kr.shnea.hellow.livekit.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.platform.PlatformProperties;
import kr.shnea.hellow.transfer.WorkTransferRepository;
import org.junit.jupiter.api.Test;
class MediaLifecycleWorkerTest {
 @Test void providerFailureDoesNotEndCallButVerifiedDepartureDoes(){
  var queues=mock(QueueItemRepository.class);var members=mock(MembershipRepository.class);var orgs=mock(OrganizationRepository.class);var media=mock(LiveKitService.class);var grants=mock(MembershipAccess.class);
  var q=new QueueItem("q",QueueItem.ItemType.CALL,kr.shnea.hellow.customer.Customer.CustomerType.INDIVIDUAL,"고객",null,"01012345678",null,"normal","",true,false,false);
  q.setOrganizationId("org");q.acceptBy("agent","상담사");q.assignOwner(new WorkspaceAccess.Actor("org","agent","상담사","issuer",null,DataScope.SELF,Set.of(),Map.of()));
  var start=Instant.parse("2026-10-04T00:00:00Z");q.requestMedia(start);q.observeMedia(start,true);q.observeMedia(start.plusSeconds(2),false);
  var member=new Membership("org","issuer","agent",Set.of("queue:accept"));
  when(queues.findByStatusAndCallEndedFalse(QueueItem.QueueStatus.PROCESSING)).thenReturn(List.of(q));when(orgs.findById("org")).thenReturn(Optional.of(new Organization("org","조직","public")));
  when(members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org","issuer","agent")).thenReturn(Optional.of(member));when(grants.grants(member)).thenReturn(Map.of("queue:accept",DataScope.SELF));
  var worker=new MediaCleanupWorker(queues,members,orgs,mock(PlatformProperties.class),media,grants,mock(WorkTransferRepository.class),Clock.fixed(start.plusSeconds(35),ZoneOffset.UTC));
  when(media.participantConnection(anyString(),anyString())).thenThrow(new IllegalStateException("provider unavailable"));worker.cleanup();assertThat(q.isCallEnded()).isFalse();verify(queues,never()).save(any());
  doReturn(new LiveKitService.ParticipantConnection(false,false,null)).when(media).participantConnection(anyString(),anyString());worker.cleanup();assertThat(q.isCallEnded()).isTrue();verify(queues).save(q);
 }
}
