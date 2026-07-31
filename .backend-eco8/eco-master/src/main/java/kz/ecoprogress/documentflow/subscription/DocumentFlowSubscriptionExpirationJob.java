package kz.ecoprogress.documentflow.subscription;

import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlement;
import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlementRepository;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowNotificationOutboxService;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Sweeps time-based subscription/entitlement transitions. Fixed rate chosen as every 15 minutes -
 * frequent enough that a customer's access degrades (TRIAL/ACTIVE -> GRACE_PERIOD/EXPIRED)
 * within a reasonable window of the actual deadline, without hammering the DB; matches the
 * granularity most SaaS billing sweeps use and is cheap since each run is a handful of indexed
 * "status=X AND deadline < now" queries.
 *
 * Idempotency: every transition query is scoped to rows still in the SOURCE status (e.g.
 * "status=TRIAL AND trialEndsAt < now") - a row already moved to EXPIRED by a previous run no
 * longer matches on the next run, so running this twice back-to-back performs no extra writes the
 * second time. No distributed lock is taken: this app has no Redis (checked application*.properties
 * for spring.redis.* - absent) and is not documented as running multiple instances in this
 * environment; if it's ever horizontally scaled, two instances could both pick up the same batch
 * and attempt the same (safe, idempotent-by-WHERE-clause) update concurrently - a documented
 * limitation, not a correctness bug, but worth a real lock (e.g. Redis or a DB advisory lock)
 * before scaling out.
 */
@Component
public class DocumentFlowSubscriptionExpirationJob {

    private static final Logger log = LoggerFactory.getLogger(DocumentFlowSubscriptionExpirationJob.class);

    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final OrganizationEntitlementRepository entitlementRepository;
    private final SubscriptionService subscriptionService;
    private final DocumentFlowMembershipRepository membershipRepository;
    private final DocumentFlowNotificationOutboxService notificationOutboxService;

    public DocumentFlowSubscriptionExpirationJob(OrganizationSubscriptionRepository subscriptionRepository,
                                                  OrganizationEntitlementRepository entitlementRepository,
                                                  SubscriptionService subscriptionService,
                                                  DocumentFlowMembershipRepository membershipRepository,
                                                  DocumentFlowNotificationOutboxService notificationOutboxService) {
        this.subscriptionRepository = subscriptionRepository;
        this.entitlementRepository = entitlementRepository;
        this.subscriptionService = subscriptionService;
        this.membershipRepository = membershipRepository;
        this.notificationOutboxService = notificationOutboxService;
    }

    @Scheduled(fixedRateString = "${eco.document-flow.expiration-job-interval-ms:900000}") // 15 minutes
    @Transactional
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        expireTrials(now);
        graceOrExpireActive(now);
        expireGracePeriods(now);
        expireEntitlements(now);
    }

    /** TRIAL past trialEndsAt -> EXPIRED. Design choice: grace period does NOT apply to trials -
     *  a trial that runs out simply ends (there was never a paid period to "grace" against); only
     *  a paid ACTIVE subscription gets a grace window before losing access. */
    private void expireTrials(LocalDateTime now) {
        for (OrganizationSubscription sub : subscriptionRepository.findByStatusAndTrialEndsAtBefore(SubscriptionStatus.TRIAL, now)) {
            transition(sub, SubscriptionStatus.EXPIRED, SubscriptionEventType.EXPIRED, "Пробный период завершён");
        }
    }

    private void graceOrExpireActive(LocalDateTime now) {
        for (OrganizationSubscription sub : subscriptionRepository.findByStatusAndExpiresAtBefore(SubscriptionStatus.ACTIVE, now)) {
            if (sub.getGraceEndsAt() != null && sub.getGraceEndsAt().isAfter(now)) {
                transition(sub, SubscriptionStatus.GRACE_PERIOD, SubscriptionEventType.EXPIRED, "Истёк срок подписки, начат льготный период");
            } else {
                transition(sub, SubscriptionStatus.EXPIRED, SubscriptionEventType.EXPIRED, "Истёк срок подписки");
            }
        }
    }

    private void expireGracePeriods(LocalDateTime now) {
        for (OrganizationSubscription sub : subscriptionRepository.findByStatusAndGraceEndsAtBefore(SubscriptionStatus.GRACE_PERIOD, now)) {
            transition(sub, SubscriptionStatus.EXPIRED, SubscriptionEventType.EXPIRED, "Истёк льготный период");
        }
    }

    private void expireEntitlements(LocalDateTime now) {
        for (OrganizationEntitlement entitlement : entitlementRepository.findByExpiresAtBeforeAndEnabledTrue(now)) {
            entitlement.setEnabled(false);
            entitlementRepository.save(entitlement);
        }
    }

    private void transition(OrganizationSubscription sub, SubscriptionStatus newStatus, SubscriptionEventType eventType, String reason) {
        SubscriptionStatus oldStatus = sub.getStatus();
        sub.setStatus(newStatus);
        subscriptionRepository.save(sub);
        subscriptionService.appendEvent(sub, eventType, oldStatus, newStatus, reason, null, null);
        notifyMembers(sub, reason);
        log.info("Document-flow subscription {} (org={}) transitioned {} -> {}: {}", sub.getId(), sub.getOrganizationId(), oldStatus, newStatus, reason);
    }

    private void notifyMembers(OrganizationSubscription sub, String reason) {
        List<DocumentFlowMembership> members = membershipRepository.findByOrganizationIdAndStatus(sub.getOrganizationId(), MembershipStatus.ACTIVE);
        for (DocumentFlowMembership member : members) {
            notificationOutboxService.enqueue(member.getUserId(), sub.getOrganizationId(),
                    "Изменение статуса подписки \"Документооборот\"", reason, "DOCUMENT_FLOW_SUBSCRIPTION");
        }
    }
}
