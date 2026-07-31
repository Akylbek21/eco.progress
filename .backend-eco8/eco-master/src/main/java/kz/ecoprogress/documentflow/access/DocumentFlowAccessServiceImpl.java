package kz.ecoprogress.documentflow.access;

import kz.ecoprogress.documentflow.entitlement.EntitlementService;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.usage.OrganizationUsage;
import kz.ecoprogress.documentflow.usage.OrganizationUsageRepository;
import kz.ecoprogress.documentflow.usage.UsageLimitService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class DocumentFlowAccessServiceImpl implements DocumentFlowAccessService {

    private final DocumentFlowMembershipRepository membershipRepository;
    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository planRepository;
    private final EntitlementService entitlementService;
    private final UsageLimitService usageLimitService;
    private final OrganizationUsageRepository usageRepository;

    public DocumentFlowAccessServiceImpl(DocumentFlowMembershipRepository membershipRepository,
                                          OrganizationSubscriptionRepository subscriptionRepository,
                                          SubscriptionPlanRepository planRepository,
                                          EntitlementService entitlementService,
                                          UsageLimitService usageLimitService,
                                          OrganizationUsageRepository usageRepository) {
        this.membershipRepository = membershipRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.entitlementService = entitlementService;
        this.usageLimitService = usageLimitService;
        this.usageRepository = usageRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public AccessContext getAccessContext(Long userId, Long organizationId) {
        if (userId == null || organizationId == null) {
            return new AccessContext(false, organizationId, null, null, true, null,
                    Set.of(), Set.of(), Map.of(), Map.of(), List.of(), null, null, null, "Не авторизован");
        }

        Optional<DocumentFlowMembership> membershipOpt = membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .filter(m -> m.getStatus() != MembershipStatus.REMOVED);
        if (membershipOpt.isEmpty()) {
            return new AccessContext(true, organizationId, null, null, true, null,
                    Set.of(), Set.of(), Map.of(), Map.of(), List.of(), null, null, null,
                    "Пользователь не состоит в организации");
        }
        DocumentFlowMembership membership = membershipOpt.get();

        Optional<OrganizationSubscription> subscriptionOpt = subscriptionRepository
                .findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        if (subscriptionOpt.isEmpty()) {
            return new AccessContext(true, organizationId, membership.getId(), null, true, null,
                    Set.of(), membership.getRoleCode().defaultPermissions(), Map.of(), Map.of(), List.of(),
                    null, null, null, "Нет активной подписки на модуль документооборота");
        }
        OrganizationSubscription subscription = subscriptionOpt.get();
        SubscriptionPlan plan = planRepository.findById(subscription.getPlanId()).orElse(null);
        AccessContext.PlanSummary planSummary = plan != null
                ? new AccessContext.PlanSummary(plan.getCode(), plan.getNameRu())
                : null;

        Set<FeatureCode> features = entitlementService.enabledFeatures(organizationId, subscription.getPlanId());
        Set<DocumentFlowPermission> permissions = membership.getRoleCode().defaultPermissions();

        Map<UsageMetric, Long> limits = new EnumMap<>(UsageMetric.class);
        for (UsageMetric metric : UsageMetric.values()) {
            limits.put(metric, usageLimitService.effectiveLimit(organizationId, metric));
        }
        Map<UsageMetric, Long> usage = currentUsageMap(organizationId);

        List<String> availableActions = permissions.stream().map(Enum::name).sorted().toList();

        boolean readOnly;
        String reason;
        LocalDateTime effectiveExpiresAt;
        switch (subscription.getStatus()) {
            case ACTIVE, TRIAL -> {
                readOnly = false;
                reason = null;
                effectiveExpiresAt = subscription.getExpiresAt();
            }
            case GRACE_PERIOD -> {
                readOnly = false;
                effectiveExpiresAt = subscription.getGraceEndsAt() != null ? subscription.getGraceEndsAt() : subscription.getExpiresAt();
                reason = "Действует льготный период, продлите подписку до " + effectiveExpiresAt;
            }
            case EXPIRED, CANCELLED -> {
                readOnly = true;
                effectiveExpiresAt = subscription.getExpiresAt();
                reason = "Подписка истекла - доступ только для чтения";
            }
            case SUSPENDED -> {
                readOnly = true;
                effectiveExpiresAt = subscription.getExpiresAt();
                reason = subscription.getSuspensionReason() != null ? subscription.getSuspensionReason() : "Доступ приостановлен администратором";
            }
            default -> {
                readOnly = true;
                effectiveExpiresAt = subscription.getExpiresAt();
                reason = "Подписка ожидает активации";
            }
        }

        Long daysRemaining = effectiveExpiresAt != null
                ? Duration.between(LocalDateTime.now(), effectiveExpiresAt).toDays()
                : null;

        return new AccessContext(true, organizationId, membership.getId(), subscription.getStatus(), readOnly,
                planSummary, features, permissions, limits, usage, availableActions,
                subscription.getStartsAt(), effectiveExpiresAt, daysRemaining, reason);
    }

    private Map<UsageMetric, Long> currentUsageMap(Long organizationId) {
        Optional<OrganizationUsage> usage = usageRepository.findCurrent(organizationId, LocalDateTime.now());
        Map<UsageMetric, Long> result = new EnumMap<>(UsageMetric.class);
        for (UsageMetric metric : UsageMetric.values()) {
            result.put(metric, usage.map(u -> u.getValue(metric)).orElse(0L));
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean canOpenModule(Long userId, Long organizationId) {
        return getAccessContext(userId, organizationId).canOpenModule();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasFeature(Long organizationId, FeatureCode feature) {
        Optional<OrganizationSubscription> subscription = subscriptionRepository
                .findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        return subscription.isPresent() && entitlementService.isEnabled(organizationId, subscription.get().getPlanId(), feature);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasPermission(Long userId, Long organizationId, DocumentFlowPermission permission) {
        return membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .map(m -> m.getRoleCode().defaultPermissions().contains(permission))
                .orElse(false);
    }

    @Override
    @Transactional(readOnly = true)
    public void requirePermission(Long userId, Long organizationId, DocumentFlowPermission permission) {
        DocumentFlowMembership membership = requireMembership(userId, organizationId);
        if (!membership.getRoleCode().defaultPermissions().contains(permission)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Недостаточно прав для действия: " + permission);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void requireActiveAccess(Long userId, Long organizationId) {
        requireMembership(userId, organizationId);
        requireNonSuspendedNonPending(organizationId);
        // ACTIVE/TRIAL/GRACE_PERIOD/EXPIRED/CANCELLED all permit read access at this point.
    }

    @Override
    @Transactional(readOnly = true)
    public void requireWriteAccess(Long userId, Long organizationId) {
        requireMembership(userId, organizationId);
        OrganizationSubscription subscription = requireNonSuspendedNonPending(organizationId);
        if (subscription.getStatus() == SubscriptionStatus.EXPIRED || subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            throw new DocumentFlowReadOnlyException("Подписка истекла - доступна только для чтения, запись запрещена");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void requireFeature(Long organizationId, FeatureCode feature) {
        Optional<OrganizationSubscription> subscriptionOpt = subscriptionRepository
                .findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        if (subscriptionOpt.isEmpty()) {
            throw new DocumentFlowSubscriptionRequiredException("Нет активной подписки на модуль документооборота");
        }
        OrganizationSubscription subscription = subscriptionOpt.get();
        boolean enabled = entitlementService.isEnabled(organizationId, subscription.getPlanId(), feature);
        if (enabled) {
            return;
        }
        boolean planHasIt = entitlementService.planOnlyEnabled(subscription.getPlanId(), feature);
        if (planHasIt) {
            throw DocumentFlowFeatureNotAvailableException.disabledByEntitlement(feature);
        }
        throw DocumentFlowFeatureNotAvailableException.planDoesNotSupport(feature);
    }

    /** Only an ACTIVE membership grants any access at all (module spec §5: "запрещает INVITED,
     *  SUSPENDED, REMOVED"). Previously this only excluded REMOVED, so a user who had not yet
     *  accepted an invitation, or whose membership was separately suspended, still passed
     *  requireActiveAccess/requireWriteAccess as long as the organization's subscription was fine -
     *  only the narrower hasPermission() check filtered to ACTIVE. Both checks now agree. */
    private DocumentFlowMembership requireMembership(Long userId, Long organizationId) {
        return membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> new DocumentFlowMembershipRequiredException(
                        "Пользователь не состоит в организации " + organizationId + " или членство не активно"));
    }

    private OrganizationSubscription requireNonSuspendedNonPending(Long organizationId) {
        // findMostRecent (not findCurrentNonTerminal): EXPIRED/CANCELLED must still be found here
        // so requireWriteAccess's own EXPIRED/CANCELLED check (below) can fire DocumentFlowReadOnlyException
        // instead of this method mistaking "subscription lapsed" for "no subscription ever existed".
        Optional<OrganizationSubscription> subscriptionOpt = subscriptionRepository.findMostRecent(organizationId);
        if (subscriptionOpt.isEmpty()) {
            throw new DocumentFlowSubscriptionRequiredException("Нет активной подписки на модуль документооборота");
        }
        OrganizationSubscription subscription = subscriptionOpt.get();
        if (subscription.getStatus() == SubscriptionStatus.SUSPENDED) {
            throw new DocumentFlowAccessSuspendedException(
                    subscription.getSuspensionReason() != null ? subscription.getSuspensionReason() : "Доступ приостановлен администратором");
        }
        if (subscription.getStatus() == SubscriptionStatus.PENDING) {
            throw new DocumentFlowSubscriptionRequiredException("Подписка ожидает активации");
        }
        return subscription;
    }
}
