package kz.ecoprogress.documentflow.usage;

import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverride;
import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverrideRepository;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.PlanFeature;
import kz.ecoprogress.documentflow.plan.PlanFeatureRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/**
 * Reserves usage against an organization's effective plan limit, called by Agents B ("would this
 * document exceed the monthly document limit") and C ("would this signature exceed the signature
 * limit") before actually creating a document/signature.
 *
 * Effective limit resolution, per metric:
 *  - DOCUMENTS_CREATED / SIGNATURES_CREATED / EXTERNAL_SIGNATURES_CREATED: the plan's own
 *    {@code plan_features.limit_value} for DOCUMENT_CREATE / MULTI_SIGNING / EXTERNAL_SIGNING
 *    respectively, further overridden (if an {@code organization_plan_overrides} row exists for
 *    that same featureCode) by the override's limitValue - presence of the override row wins
 *    regardless of whether its limitValue is itself null (null override = explicitly unlimited).
 *  - STORAGE_BYTES / ACTIVE_MEMBERS: no dedicated FeatureCode exists for these two (see
 *    UsageMetric javadoc), so the plan baseline comes from the CUSTOM_LIMITS plan_features row's
 *    {@code metadataJson}, e.g. {"activeMembers":10,"storageBytes":10737418240}; an org override
 *    is an organization_plan_overrides row with featureCode=CUSTOM_LIMITS and
 *    {@code metric = "STORAGE_BYTES"|"ACTIVE_MEMBERS"} (see OverrideMetricTag).
 *  - A null effective limit at any point means "unlimited" - checkAndReserve skips the check
 *    entirely and just increments.
 *
 * Increment strategy: optimistic-lock retry (JPA @Version on OrganizationUsage) rather than a raw
 * UPDATE ... WHERE counter < limit query - simpler to keep symmetric with the "read effective
 * limit, then decide" logic above, at the cost of a small retry loop under contention.
 */
@Service
public class UsageLimitService {

    private static final int MAX_RETRIES = 5;

    private final OrganizationUsageRepository usageRepository;
    private final OrganizationSubscriptionRepository subscriptionRepository;
    private final PlanFeatureRepository planFeatureRepository;
    private final OrganizationPlanOverrideRepository overrideRepository;
    private final ObjectMapper objectMapper;

    public UsageLimitService(OrganizationUsageRepository usageRepository,
                              OrganizationSubscriptionRepository subscriptionRepository,
                              PlanFeatureRepository planFeatureRepository,
                              OrganizationPlanOverrideRepository overrideRepository,
                              ObjectMapper objectMapper) {
        this.usageRepository = usageRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planFeatureRepository = planFeatureRepository;
        this.overrideRepository = overrideRepository;
        this.objectMapper = objectMapper;
    }

    /** Effective limit for the given organization+metric, or {@code null} if unlimited. */
    @Transactional(readOnly = true)
    public Long effectiveLimit(Long organizationId, UsageMetric metric) {
        LocalDateTime now = LocalDateTime.now();
        Optional<OrganizationSubscription> subscription = subscriptionRepository
                .findCurrentNonTerminal(organizationId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        if (subscription.isEmpty()) {
            return 0L;
        }
        FeatureCode limitFeature = metric.limitFeature();
        Optional<PlanFeature> planFeature = planFeatureRepository.findByPlanIdAndFeatureCode(subscription.get().getPlanId(), limitFeature);

        // NOTE: deliberately NOT Optional#map+orElse here - PlanFeature#getLimitValue legitimately
        // returns null to mean "unlimited", and Optional#map treats a null-returning mapper as
        // "absent", which would collapse "row present, limit null (unlimited)" into "row missing
        // (blocked, limit 0)" - two very different things. Presence is checked explicitly instead.
        // Long.valueOf(0L) (not the primitive literal 0L) in the else branch on purpose: a ternary
        // mixing a boxed Long operand with a primitive long operand unboxes the Long operand for
        // numeric promotion, which throws NPE right here whenever the "unlimited" (null) branch is
        // taken - both branches must stay boxed Long for a present-but-null limitValue to survive.
        Long baseLimit = switch (metric) {
            case DOCUMENTS_CREATED, SIGNATURES_CREATED, EXTERNAL_SIGNATURES_CREATED ->
                    planFeature.isPresent() ? planFeature.get().getLimitValue() : Long.valueOf(0L);
            case STORAGE_BYTES, ACTIVE_MEMBERS ->
                    planFeature.isPresent() ? readMetadataLimit(planFeature.get(), metric) : Long.valueOf(0L);
        };

        List<OrganizationPlanOverride> overrides = overrideRepository.findByOrganizationIdAndFeatureCode(organizationId, limitFeature);
        Optional<OrganizationPlanOverride> activeOverride = overrides.stream()
                .filter(o -> o.isCurrentlyActive(now))
                .filter(o -> metric != UsageMetric.STORAGE_BYTES && metric != UsageMetric.ACTIVE_MEMBERS
                        || metric.name().equals(o.getMetric()))
                .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()));

        // Same null-vs-absent care as above: presence of the override row wins even if its own
        // limitValue is null (an explicit "make it unlimited" grant), so no Optional#map here either.
        return activeOverride.isPresent() ? activeOverride.get().getLimitValue() : baseLimit;
    }

    private Long readMetadataLimit(PlanFeature planFeature, UsageMetric metric) {
        String json = planFeature.getMetadataJson();
        if (json == null || json.isBlank()) {
            return null;
        }
        JsonNode node = objectMapper.readTree(json);
        String key = metric == UsageMetric.STORAGE_BYTES ? "storageBytes" : "activeMembers";
        JsonNode value = node.get(key);
        return (value == null || value.isNull()) ? null : value.asLong();
    }

    /**
     * Checks the effective limit and, if not exceeded, increments the counter by 1 and returns
     * the new value. Throws {@link DocumentFlowLimitExceededException} otherwise. Idempotent
     * only in the sense that a failed call performs no increment - callers wanting idempotency
     * across retries should pair this with kz.ecoprogress.documentflow.infrastructure.
     * DocumentFlowIdempotencyService at the call site.
     */
    @Transactional
    public long checkAndReserve(Long organizationId, UsageMetric metric) {
        return reserve(organizationId, metric, 1L);
    }

    @Transactional
    public long reserve(Long organizationId, UsageMetric metric, long amount) {
        Long limit = effectiveLimit(organizationId, metric);
        LocalDateTime now = LocalDateTime.now();

        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            OrganizationUsage usage = currentOrNewUsage(organizationId, now);
            long current = usage.getValue(metric);
            if (limit != null && current + amount > limit) {
                throw new DocumentFlowLimitExceededException(metric, limit, current);
            }
            usage.increment(metric, amount);
            try {
                usageRepository.saveAndFlush(usage);
                return usage.getValue(metric);
            } catch (ObjectOptimisticLockingFailureException concurrentUpdate) {
                // Someone else incremented the same row between our read and write - reload and
                // retry from a fresh read rather than failing the caller for pure contention.
            }
        }
        throw new IllegalStateException("Could not reserve usage for organization " + organizationId
                + " metric " + metric + " after " + MAX_RETRIES + " retries (high contention)");
    }

    /**
     * Compensating release for the reservation model (module spec §19): a route that reserved
     * {@code amount} up front (see SigningRouteService#prepareForSigning) but never completed
     * (cancelled, or rejected/returned-for-revision before every required signature was collected)
     * must give that reservation back, or the organization's monthly quota would be permanently
     * consumed by abandoned routes. Floors at zero rather than going negative - releasing more
     * than the current period's counter holds (e.g. the period rolled over between reserve and
     * release) would otherwise corrupt the next period's starting count.
     */
    @Transactional
    public void release(Long organizationId, UsageMetric metric, long amount) {
        if (amount <= 0) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            OrganizationUsage usage = currentOrNewUsage(organizationId, now);
            long current = usage.getValue(metric);
            usage.increment(metric, -Math.min(amount, current));
            try {
                usageRepository.saveAndFlush(usage);
                return;
            } catch (ObjectOptimisticLockingFailureException concurrentUpdate) {
                // Same contention/retry pattern as reserve().
            }
        }
        throw new IllegalStateException("Could not release usage for organization " + organizationId
                + " metric " + metric + " after " + MAX_RETRIES + " retries (high contention)");
    }

    private OrganizationUsage currentOrNewUsage(Long organizationId, LocalDateTime now) {
        return usageRepository.findCurrent(organizationId, now).orElseGet(() -> {
            YearMonth month = YearMonth.from(now);
            OrganizationUsage usage = new OrganizationUsage();
            usage.setOrganizationId(organizationId);
            usage.setPeriodStart(month.atDay(1).atStartOfDay());
            usage.setPeriodEnd(month.plusMonths(1).atDay(1).atStartOfDay());
            return usageRepository.saveAndFlush(usage);
        });
    }
}
