package kz.ecoprogress.documentflow.subscription;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyRepository;
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
    private final CompanyRepository companyRepository;

    public SubscriptionService(OrganizationSubscriptionRepository subscriptionRepository,
                                SubscriptionEventRepository eventRepository,
                                CompanyRepository companyRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.eventRepository = eventRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional(readOnly = true)
    public Optional<OrganizationSubscription> findCurrentNonTerminal(Long organizationId) {
        return subscriptionRepository.findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
    }

    /** Unlike {@link #findCurrentNonTerminal}, also returns EXPIRED/CANCELLED rows - use this
     *  wherever a row must still be found even after it has lapsed (admin history/card, extend()
     *  on an EXPIRED subscription). */
    @Transactional(readOnly = true)
    public Optional<OrganizationSubscription> findMostRecent(Long organizationId) {
        return subscriptionRepository.findMostRecent(organizationId);
    }

    /** All subscriptions across all organizations - used by the admin listing endpoint. */
    @Transactional(readOnly = true)
    public List<OrganizationSubscription> findAll() {
        return subscriptionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public OrganizationSubscription getByOrganizationOrThrow(Long organizationId) {
        return getCurrentNonTerminalOrThrow(organizationId);
    }

    /** Write-access / "is this org's subscription currently usable" callers - PENDING/TRIAL/
     *  ACTIVE/GRACE_PERIOD/SUSPENDED only, never EXPIRED/CANCELLED. */
    @Transactional(readOnly = true)
    public OrganizationSubscription getCurrentNonTerminalOrThrow(Long organizationId) {
        return findCurrentNonTerminal(organizationId)
                .orElseThrow(() -> new NotFoundException("У организации нет активной подписки на модуль документооборота", "DOCUMENT_FLOW_SUBSCRIPTION_NOT_FOUND"));
    }

    /** Admin history/card and extend() callers - the most recent row regardless of status,
     *  including EXPIRED/CANCELLED, so an admin can still see/act on a lapsed subscription. */
    @Transactional(readOnly = true)
    public OrganizationSubscription getMostRecentOrThrow(Long organizationId) {
        return findMostRecent(organizationId)
                .orElseThrow(() -> new NotFoundException("У организации нет подписки на модуль документооборота", "DOCUMENT_FLOW_SUBSCRIPTION_NOT_FOUND"));
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
        // Concurrency guard (task item 15/A.3): locks the organization's `companies` row for the
        // duration of this transaction BEFORE the findCurrentNonTerminal check below, so two
        // parallel grant requests for the same organization serialize instead of both observing
        // "no non-terminal subscription yet" and both inserting one. See
        // CompanyRepository#lockForUpdate's javadoc for why the company row (not the subscription
        // row) is the lock target. This is the primary defense; V63's generated-column unique
        // index is the secondary, DB-level backstop in case this method is ever bypassed.
        companyRepository.lockForUpdate(organizationId);

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

    /** Uses {@link #getMostRecentOrThrow} - not {@link #getCurrentNonTerminalOrThrow} - because an
     *  EXPIRED subscription is exactly the common case an admin needs to extend, and
     *  getCurrentNonTerminalOrThrow (non-terminal only) can never find an EXPIRED row, making that
     *  branch below unreachable. CANCELLED is deliberately NOT extendable here - a cancelled
     *  subscription requires a fresh grant via the access-grant flow, not an extension. */
    @Transactional
    public OrganizationSubscription extend(Long organizationId, LocalDateTime newExpiresAt, Long actorUserId, String reason, Long expectedVersion) {
        OrganizationSubscription subscription = getMostRecentOrThrow(organizationId);
        checkVersion(subscription, expectedVersion);
        SubscriptionStatus oldStatus = subscription.getStatus();
        if (oldStatus == SubscriptionStatus.CANCELLED) {
            throw new kz.eco.common.exception.BadRequestException(
                    "Отменённую подписку нельзя продлить - оформите новый доступ",
                    "DOCUMENT_FLOW_SUBSCRIPTION_CANCELLED_CANNOT_EXTEND");
        }
        subscription.setExpiresAt(newExpiresAt);
        if (oldStatus == SubscriptionStatus.EXPIRED || oldStatus == SubscriptionStatus.GRACE_PERIOD) {
            subscription.setStatus(SubscriptionStatus.ACTIVE);
        }
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.EXTENDED, oldStatus, subscription.getStatus(), reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription suspend(Long organizationId, Long actorUserId, String reason, Long expectedVersion) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        checkVersion(subscription, expectedVersion);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.SUSPENDED);
        subscription.setSuspendedBy(actorUserId);
        subscription.setSuspensionReason(reason);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.SUSPENDED, oldStatus, SubscriptionStatus.SUSPENDED, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription restore(Long organizationId, Long actorUserId, String reason, Long expectedVersion) {
        OrganizationSubscription subscription = subscriptionRepository.findCurrentNonTerminal(organizationId, List.of(SubscriptionStatus.SUSPENDED))
                .orElseThrow(() -> new NotFoundException("Подписка не приостановлена", "DOCUMENT_FLOW_SUBSCRIPTION_NOT_SUSPENDED"));
        checkVersion(subscription, expectedVersion);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setSuspendedBy(null);
        subscription.setSuspensionReason(null);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.RESTORED, oldStatus, SubscriptionStatus.ACTIVE, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription revoke(Long organizationId, Long actorUserId, String reason, Long expectedVersion) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        checkVersion(subscription, expectedVersion);
        SubscriptionStatus oldStatus = subscription.getStatus();
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.MANUAL_ACCESS_REVOKED, oldStatus, SubscriptionStatus.CANCELLED, reason, actorUserId, null);
        return subscription;
    }

    @Transactional
    public OrganizationSubscription changePlan(Long organizationId, Long newPlanId, Long actorUserId, String reason, Long expectedVersion) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        checkVersion(subscription, expectedVersion);
        subscription.setPlanId(newPlanId);
        subscription = subscriptionRepository.save(subscription);
        appendEvent(subscription, SubscriptionEventType.PLAN_CHANGED, subscription.getStatus(), subscription.getStatus(), reason, actorUserId, null);
        return subscription;
    }

    /** Version-check-only overload for callers (limits/entitlements) that mutate side tables
     *  (overrides/entitlements) rather than the subscription row itself, but still need to fail
     *  loudly on a stale {@code expectedVersion} before doing so. */
    @Transactional(readOnly = true)
    public OrganizationSubscription checkVersionAndGet(Long organizationId, Long expectedVersion) {
        OrganizationSubscription subscription = getByOrganizationOrThrow(organizationId);
        checkVersion(subscription, expectedVersion);
        return subscription;
    }

    /** Optimistic-lock guard shared by every admin mutation below: {@code expectedVersion} is the
     *  {@code @Version} the client last saw (surfaced as {@code subscriptionVersion} on
     *  {@code AdminOrganizationAccessDto}); a mismatch means someone else mutated this subscription
     *  in between, and we must fail loudly rather than silently overwrite their change. */
    private void checkVersion(OrganizationSubscription subscription, Long expectedVersion) {
        if (expectedVersion != null && !expectedVersion.equals(subscription.getVersion())) {
            throw new ConflictException(
                    "Подписка была изменена другим администратором - обновите данные и повторите попытку",
                    "VERSION_CONFLICT");
        }
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
