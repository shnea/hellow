package kr.shnea.hellow.recording;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.transaction.annotation.Transactional;
public interface CallRecordingRepository extends JpaRepository<CallRecording,String> {
  Optional<CallRecording> findByOrganizationIdAndQueueCode(String organizationId,String queueCode);
  @Query("select r.id from CallRecording r where r.state not in (kr.shnea.hellow.recording.CallRecording$State.READY,kr.shnea.hellow.recording.CallRecording$State.NO_AUDIO,kr.shnea.hellow.recording.CallRecording$State.FAILED) and r.retryAt<=:now order by r.createdAt")
  List<String> pending(Instant now,org.springframework.data.domain.Pageable page);
  @Transactional @Modifying
  @Query("update CallRecording r set r.leaseUntil=:until where r.id=:id and (r.leaseUntil is null or r.leaseUntil<:now)")
  int claim(String id,Instant now,Instant until);
}
