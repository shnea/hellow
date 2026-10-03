package kr.shnea.hellow.livekit;

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
  private final kr.shnea.hellow.transfer.WorkTransferRepository transfers;
  private final java.time.Clock clock;

  public MediaCleanupWorker(
      QueueItemRepository queues,
      MembershipRepository members,
      OrganizationRepository organizations,
      PlatformProperties platform,
      LiveKitService media, MembershipAccess authority,
      kr.shnea.hellow.transfer.WorkTransferRepository transfers, java.time.Clock clock) {
    this.queues = queues;
    this.members = members;
    this.organizations = organizations;
    this.platform = platform;
    this.media = media;
    this.authority=authority;
    this.transfers=transfers;
    this.clock=clock;
  }

  @Scheduled(fixedDelay = 2000)
  public void cleanup() {
    for (var q : queues.findByStatusAndCallEndedFalse(QueueItem.QueueStatus.PROCESSING)) {
      if (q.getType() != QueueItem.ItemType.CALL || q.getOrganizationId() == null || q.getAssignedSubject() == null) continue;
      boolean permitted =
          organizations.findById(q.getOrganizationId()).map(Organization::isActive).orElse(false)
              && members
                  .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
                      q.getOrganizationId(), q.getOwnerIssuer() == null ? platform.getOidcIssuer() : q.getOwnerIssuer(), q.getAssignedSubject())
                  .map(
                      m ->
                          authority.grants(m).containsKey("queue:accept"))
                  .orElse(false);
      if (!permitted) {
        try {
          q.endCall();
          queues.save(q);
        } catch (org.springframework.dao.OptimisticLockingFailureException changed) {
          // Recheck the new owner and grants on the next pass after a concurrent handoff.
        }
      } else {
        try {
          String room=q.getOrganizationId()+"-"+q.getCode();
          var agent=media.participantConnection(room,q.getMediaAgentIdentity());
          var customer=media.participantConnection(room,"customer-"+q.getCode());
          if(q.observeMedia(clock.instant(),agent.active()&&agent.microphonePublished()&&customer.active()&&customer.microphonePublished()))queues.save(q);
        } catch(org.springframework.dao.OptimisticLockingFailureException changed) {
          // A handoff/end changed the owner or room while media evidence was collected.
        } catch(Exception unavailable) {
          // Provider errors are not evidence that either participant left.
          LoggerFactory.getLogger(getClass()).warn("Media lifecycle check pending for queue {}",q.getCode());
        }
      }
    }
    // Self-hosted revocation support depends on LiveKit version. Retry removals
    // through the short token lifetime so an old token cannot sustain a room.
    for (var q : queues.findByCallEndedTrueAndMediaCleanupUntilIsNotNull()) {
      if (q.getType() != QueueItem.ItemType.CALL || q.getOrganizationId() == null) continue;
      String room = q.getOrganizationId() + "-" + q.getCode();
      try {
        var identities = new java.util.LinkedHashSet<String>();
        if (q.getAssignedSubject() != null) identities.add(q.getMediaAgentIdentity());
        identities.add("customer-" + q.getCode());
        for (var transfer : transfers.findByOrganizationIdAndQueueCodeAndStatus(
            q.getOrganizationId(), q.getCode(), kr.shnea.hellow.transfer.WorkTransfer.Status.ACCEPTED))
          identities.add(transfer.getFromMediaIdentity() == null
              ? "agent-" + transfer.getFromSubject() : transfer.getFromMediaIdentity());
        boolean succeeded = true;
        for (String identity : identities) {
          try { media.removeParticipant(room, identity); }
          catch (Exception unavailable) { succeeded = false; }
        }
        if (!succeeded) throw new IllegalStateException("Participant cleanup pending");
        // An expired deadline means retry until success, never abandon the persisted intent.
        q.mediaCleanupSucceeded(clock.instant());
        if (q.getMediaCleanupUntil() == null) queues.save(q);
      } catch (Exception e) {
        LoggerFactory.getLogger(getClass()).warn("Media cleanup pending for queue {}", q.getCode());
      }
    }
  }
}
