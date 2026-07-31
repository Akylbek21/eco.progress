package kz.ecoprogress.documentflow.subscription;

import kz.eco.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Every state transition on {@link OrganizationSubscription} goes through one of these methods -
 * never a bare field mutation from a controller - so a {@link SubscriptionEvent} is always
 * appended alongside the status change (ticket requirement for the admin access-grant flow and
 * every other admin subscription action).
 *
 * "At most one non-terminal subscription per organization" (PENDING/TRIAL/ACTIVE/GRACE_PERIOD/
 * SUSPENDED) is enforced here, not via a DB constraint: {@link #grantOrUpdateActive} finds any
 * existing non-terminal row for the organization and updates it in place rather than inserting a
 * second one - there is never a moment with two non-terminal rows for the same organization.
 */
@Service
public class SubscriptionService {

    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final SubscriptionEventRepository eventRepository;

    public SubscriptionService(OrganizationSubscriptionRepository subscriptionRepository,
                                SubscriptionEventRepository eventRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.eventRepository = eventRepository;
    }

    @Transactional(readOnly = true)
    public Optional<OrganizationSubscription> findCurrentNonTerminal(Long organizationId) {
        return subscriptionRepository.findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
    }

    /** All subscriptions across all organizations - used by the admin listing endpoint. */
    @Transactional(readOnly = true)
    public List<OrganizationSubscription> findAll() {
        return subscriptionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public OrganizationSubscription getByOrganizationOrThrow(Long organizationId) {
        return findCurrentNonTerminal(organizationId)
                .orElseThrow(() -> new NotFoundException("У организации нет активной подписки на модуль документооборота", "DOCUMENT_FLOW_SUBSCRIPTION_NOT_FOUND"));
    }

    /**
     * Admin access-grant entry point (ticket step 10, POST .../access-grants): if the
     * organization already has a non-terminal subscription, updates it in place (plan/dates/
     * payment info) and moves it to ACTIVE; otherwise inserts a brand-new ACTIVE row. Either way
     * exactly one non-terminal row exists afterwards. Emits MANUAL_ACCESS_GRANTED.
     */
    @Transactional
    public OrganizationSubscription grantOrUpdateActive(Long organizationId, Long planId, LocalDateTime startsAt,
                                                         LocalDateTime expiresAt, PaymentMode paymentMode,
                                                         String paymentReference, Long actorUserId, String reason) {
        Optional<OrganizationSubscription> existing = findCurrentNonTerminal(organizationId);
        OrganizationSubscription subscription = existing.orElseGet(OrganizationSubscription::new);
        SubscriptionStatus oldStatus = subscription.getStatus();
        boolean isNew = existing.isEmpty();

        subscription.setOrganizationId(organizationId);
        subscription.setPlanId(planId);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(startsAt);
        subscription.setExpiresAt(expiresAt);
        subscription.setPaymentMode(paymentMode);
        subscription.setPaymentReference(paymentReference);
        subscription.setActivatedBy(actorUserId);
        subscription = subscriptionRepository.save(subscription);

        if (isNew) {
            appendEvent(subscription, SubscriptionEventType.CREATED, null, SubscriptionStatus.PENDING, "Подписка создана", actorUserId, null);
        }
        appendEvent(subscription, SubscriptionEventType.MANUAL_ACCESS_GRANTED, oldStatus, SubscriptionStatus.ACTIVE, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription extend(Long organizationId, LocalDateTime newExpiresAt, Long actorUserId, String reason) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setExpiresAt(newExpiresAt);
        if (oldStatus == SubscriptionStatus.EXPIRED || oldStatus == SubscriptionStatus.GRACE_PERIOD) {
            subscription.setStatus(SubscriptionStatus.ACTIVE);
        }
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.EXTENDED, oldStatus, subscription.getStatus(), reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription suspend(Long organizationId, Long actorUserId, String reason) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.SUSPENDED);
        subscription.setSuspendedBy(actorUserId);
        subscription.setSuspensionReason(reason);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.SUSPENDED, oldStatus, SubscriptionStatus.SUSPENDED, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription restore(Long organizationId, Long actorUserId, String reason) {
        OrganizationSubscription subscription = subscriptionRepository.findCurrentNonTerminal(organizationId, List.of(SubscriptionStatus.SUSPENDED))
                .orElseThrow(() -> new NotFoundException("Подписка не приостановлена", "DOCUMENT_FLOW_SUBSCRIPTION_NOT_SUSPENDED"));
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setSuspendedBy(null);
        subscription.setSuspensionReason(null);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.RESTORED, oldStatus, SubscriptionStatus.ACTIVE, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription revoke(Long organizationId, Long actorUserId, String reason) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.MANUAL_ACCESS_REVOKED, oldStatus, SubscriptionStatus.CANCELLED, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription changePlan(Long organizationId, Long newPlanId, Long actorUserId, String reason) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        subscription.setPlanId(newPlanId);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.PLAN_CHANGED, subscription.getStatus(), subscription.getStatus(), reason, actorUserId, null);
        return subscription;
    }

    /** Generic hook for callers (admin limits/entitlements endpoints, expiration job) that need
     *  to append an event without necessarily changing {@code status}. */
    @Transactional
    public void appendEvent(OrganizationSubscription subscription, SubscriptionEventType type,
                             SubscriptionStatus oldStatus, SubscriptionStatus newStatus,
                             String reason, Long actorUserId, String metadataJson) {
        SubscriptionEvent event = new SubscriptionEvent();
        event.setSubscriptionId(subscription.getId());
        event.setOrganizationId(subscription.getOrganizationId());
        event.setEventType(type);
        event.setOldStatus(oldStatus);
        event.setNewStatus(newStatus);
        event.setReason(reason);
        event.setActorUserId(actorUserId);
        event.setMetadataJson(metadataJson);
        eventRepository.save(event);
    }
}
