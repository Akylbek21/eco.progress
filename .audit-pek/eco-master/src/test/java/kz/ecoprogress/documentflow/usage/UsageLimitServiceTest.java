package kz.ecoprogress.documentflow.usage;

import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverrideRepository;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.PlanFeature;
import kz.ecoprogress.documentflow.plan.PlanFeatureRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Reserving up to the plan's effective limit succeeds; one more throws
 * DocumentFlowLimitExceededException with the right metric-specific code.
 */
@ExtendWith(MockitoExtension.class)
class UsageLimitServiceTest {

    private static final Long ORG_ID = 42L;

    @Mock private OrganizationUsageRepository usageRepository;
    @Mock private OrganizationSubscriptionRepository subscriptionRepository;
    @Mock private PlanFeatureRepository planFeatureRepository;
    @Mock private OrganizationPlanOverrideRepository overrideRepository;

    private UsageLimitService service;

    @BeforeEach
    void setUp() {
        service = new UsageLimitService(usageRepository, subscriptionRepository, planFeatureRepository, overrideRepository, new ObjectMapper());

        OrganizationSubscription subscription = new OrganizationSubscription();
        subscription.setId(1L);
        subscription.setOrganizationId(ORG_ID);
        subscription.setPlanId(7L);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        lenient().when(subscriptionRepository.findCurrentNonTerminal(anyLong(), any())).thenReturn(Optional.of(subscription));

        PlanFeature documentCreate = new PlanFeature();
        documentCreate.setPlanId(7L);
        documentCreate.setFeatureCode(FeatureCode.DOCUMENT_CREATE);
        documentCreate.setEnabled(true);
        documentCreate.setLimitValue(2L);
        lenient().when(planFeatureRepository.findByPlanIdAndFeatureCode(7L, FeatureCode.DOCUMENT_CREATE))
                .thenReturn(Optional.of(documentCreate));

        lenient().when(overrideRepository.findByOrganizationIdAndFeatureCode(anyLong(), any())).thenReturn(List.of());

        lenient().when(usageRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private OrganizationUsage freshUsageRow() {
        OrganizationUsage usage = new OrganizationUsage();
        usage.setId(500L);
        usage.setOrganizationId(ORG_ID);
        usage.setPeriodStart(LocalDateTime.now().minusDays(1));
        usage.setPeriodEnd(LocalDateTime.now().plusDays(29));
        return usage;
    }

    @Test
    void reservingUpToTheLimit_succeeds() {
        OrganizationUsage usage = freshUsageRow();
        when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.of(usage));

        assertEquals(1L, service.checkAndReserve(ORG_ID, UsageMetric.DOCUMENTS_CREATED));
        assertEquals(2L, service.checkAndReserve(ORG_ID, UsageMetric.DOCUMENTS_CREATED));
        assertEquals(2L, usage.getDocumentsCreated());
    }

    @Test
    void reservingOneMoreThanTheLimit_throwsWithDocumentLimitCode() {
        OrganizationUsage usage = freshUsageRow();
        usage.setDocumentsCreated(2L); // already at the plan's limit of 2
        when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.of(usage));

        DocumentFlowLimitExceededException ex = assertThrows(DocumentFlowLimitExceededException.class,
                () -> service.checkAndReserve(ORG_ID, UsageMetric.DOCUMENTS_CREATED));
        assertEquals("DOCUMENT_LIMIT_EXCEEDED", ex.code());
        assertEquals(2L, ex.getLimit());
        assertEquals(2L, ex.getCurrent());
    }

    @Test
    void noSubscription_effectiveLimitIsZero_immediatelyBlocks() {
        when(subscriptionRepository.findCurrentNonTerminal(anyLong(), any())).thenReturn(Optional.empty());
        assertEquals(0L, service.effectiveLimit(ORG_ID, UsageMetric.DOCUMENTS_CREATED));
    }

    @Test
    void release_decrementsCurrentPeriodUsage() {
        OrganizationUsage usage = freshUsageRow();
        usage.setSignaturesCreated(5L);
        when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.of(usage));

        service.release(ORG_ID, UsageMetric.SIGNATURES_CREATED, 3L);

        assertEquals(2L, usage.getSignaturesCreated());
    }

    /** Module spec §19: a cancelled/rejected-before-completion route must give its full upfront
     *  reservation back, never leaving the counter negative even if release is somehow called for
     *  more than the period currently holds (e.g. a period rollover between reserve and release). */
    @Test
    void release_neverGoesNegative() {
        OrganizationUsage usage = freshUsageRow();
        usage.setSignaturesCreated(2L);
        when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.of(usage));

        service.release(ORG_ID, UsageMetric.SIGNATURES_CREATED, 10L);

        assertEquals(0L, usage.getSignaturesCreated());
    }

    @Test
    void release_withZeroOrNegativeAmount_isNoOp() {
        service.release(ORG_ID, UsageMetric.SIGNATURES_CREATED, 0L);
        service.release(ORG_ID, UsageMetric.SIGNATURES_CREATED, -5L);
        // No stub for usageRepository.findCurrent was even needed - proves neither call touched it.
    }

    @Test
    void unlimitedFeature_nullLimitValue_neverThrows() {
        PlanFeature unlimited = new PlanFeature();
        unlimited.setPlanId(7L);
        unlimited.setFeatureCode(FeatureCode.MULTI_SIGNING);
        unlimited.setEnabled(true);
        unlimited.setLimitValue(null);
        when(planFeatureRepository.findByPlanIdAndFeatureCode(7L, FeatureCode.MULTI_SIGNING)).thenReturn(Optional.of(unlimited));

        OrganizationUsage usage = freshUsageRow();
        usage.setSignaturesCreated(10_000L);
        when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.of(usage));

        assertDoesNotThrow(() -> service.checkAndReserve(ORG_ID, UsageMetric.SIGNATURES_CREATED));
    }
}
