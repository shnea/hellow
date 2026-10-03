package kr.shnea.hellow.livekit;

import java.time.Instant;
import kr.shnea.hellow.platform.PlatformProperties;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

/**
 * Persisted termination intent survives API restart; provider failure cannot roll back CRM saves.
 */
@Component
@EnableScheduling
@ConditionalOnProperty(
    name = "hellow.media-cleanup-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class MediaCleanupWorker {
  private final QueueItemRepository queues;
  private final MembershipRepository members;
  private final OrganizationRepository organizations;
  private final PlatformProperties platform;
  private final LiveKitService media;
  private final MembershipAccess authority;

  public MediaCleanupWorker(
      QueueItemRepository queues,
      MembershipRepository members,
      OrganizationRepository organizations,
      PlatformProperties platform,
      LiveKitService media, MembershipAccess authority) {
    this.queues = queues;
    this.members = members;
    this.organizations = organizations;
    this.platform = platform;
    this.media = media;
    this.authority=authority;
  }

  @Scheduled(fixedDelay = 2000)
  public void cleanup() {
    for (var q : queues.findByStatusAndCallEndedFalse(QueueItem.QueueStatus.PROCESSING)) {
      if (q.getOrganizationId() == null || q.getAssignedSubject() == null) continue;
      boolean permitted =
          organizations.findById(q.getOrganizationId()).map(Organization::isActive).orElse(false)
              && members
                  .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
                      q.getOrganizationId(), platform.getOidcIssuer(), q.getAssignedSubject())
                  .map(
                      m ->
                          authority.grants(m).containsKey("queue:accept"))
                  .orElse(false);
      if (!permitted) {
        q.endCall();
        queues.save(q);
      }
    }
    // Self-hosted revocation support depends on LiveKit version. Retry removals
    // through the short token lifetime so an old token cannot sustain a room.
    for (var q : queues.findByCallEndedTrueAndMediaCleanupUntilAfter(Instant.now())) {
      if (q.getOrganizationId() == null) continue;
      String room = q.getOrganizationId() + "-" + q.getCode();
      try {
        if (q.getAssignedSubject() != null)
          media.removeParticipant(room, q.getMediaAgentIdentity());
        media.removeParticipant(room, "customer-" + q.getCode());
      } catch (Exception e) {
        LoggerFactory.getLogger(getClass()).warn("Media cleanup pending for queue {}", q.getCode());
      }
    }
  }
}
