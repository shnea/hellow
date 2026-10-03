package kr.shnea.hellow;
import java.time.Instant;
import kr.shnea.hellow.queue.QueueItem;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
class CallLifecycleTest {
  private QueueItem call(){return new QueueItem("clock",QueueItem.ItemType.CALL,kr.shnea.hellow.customer.Customer.CustomerType.INDIVIDUAL,"고객","","01012345678","","normal","",true,false,false);}
  @Test void connectionClockSurvivesReconnectAndHandoffAndExitEndsOnce(){
    var q=call();var now=Instant.parse("2026-10-04T00:00:00Z");q.requestMedia(now);
    assertThat(q.observeMedia(now,false)).isFalse();assertThat(q.getCallStartedAt()).isNull();
    q.observeMedia(now.plusSeconds(2),true);var start=q.getCallStartedAt();
    q.observeMedia(now.plusSeconds(5),false);q.observeMedia(now.plusSeconds(12),true);
    q.useMediaIdentity("new-agent");q.observeMedia(now.plusSeconds(15),true);assertThat(q.getCallStartedAt()).isEqualTo(start);assertThat(q.isCallEnded()).isFalse();
    q.observeMedia(now.plusSeconds(20),false);q.observeMedia(now.plusSeconds(49),false);assertThat(q.isCallEnded()).isFalse();
    q.observeMedia(now.plusSeconds(50),false);assertThat(q.isCallEnded()).isTrue();assertThat(q.getCallEndedAt()).isEqualTo(now.plusSeconds(50));
    q.endCall(now.plusSeconds(55));assertThat(q.getCallEndedAt()).isEqualTo(now.plusSeconds(50));
  }
  @Test void abandonedInitialConnectionIsTerminatedWithoutInventingTalkTime(){
    var q=call();var now=Instant.parse("2026-10-04T00:00:00Z");q.requestMedia(now);
    q.observeMedia(now.plusSeconds(59),false);assertThat(q.isCallEnded()).isFalse();
    q.requestMedia(now.plusSeconds(59));q.observeMedia(now.plusSeconds(60),false);
    assertThat(q.isCallEnded()).isTrue();assertThat(q.getCallStartedAt()).isNull();
  }
}
