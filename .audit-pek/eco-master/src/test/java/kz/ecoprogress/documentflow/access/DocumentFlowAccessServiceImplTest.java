package kz.ecoprogress.documentflow.access;

import kz.ecoprogress.documentflow.entitlement.EntitlementService;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.usage.OrganizationUsageRepository;
import kz.ecoprogress.documentflow.usage.UsageLimitService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Pure Mockito coverage (no Spring context) of the subscription-status -> AccessContext mapping -
 * every one of the 7 SubscriptionStatus values, plus the "no membership at all" tenant-isolation
 * guard on requireWriteAccess.
 */
@ExtendWith(MockitoExtension.class)
class DocumentFlowAccessServiceImplTest {

    private static final Long USER_ID = 1L;
    private static final Long ORG_ID = 100L;

    @Mock private DocumentFlowMembershipRepository membershipRepository;
    @Mock private OrganizationSubscriptionRepository subscriptionRepository;
    @Mock private SubscriptionPlanRepository planRepository;
    @Mock private EntitlementService entitlementService;
    @Mock private UsageLimitService usageLimitService;
    @Mock private OrganizationUsageRepository usageRepository;
    @Mock private UserRepository userRepository;

    private DocumentFlowTestAccessProperties testAccessProperties;
    private DocumentFlowAccessServiceImpl service;

    @BeforeEach
    void setUp() {
        testAccessProperties = new DocumentFlowTestAccessProperties();
        service = new DocumentFlowAccessServiceImpl(membershipRepository, subscriptionRepository, planRepository,
                entitlementService, usageLimitService, usageRepository, testAccessProperties, userRepository);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setId(5L);
        membership.setOrganizationId(ORG_ID);
        membership.setUserId(USER_ID);
        membership.setRoleCode(MembershipRole.DOCUMENT_MANAGER);
        membership.setStatus(MembershipStatus.ACTIVE);
        lenient().when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(membership));

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(9L);
        plan.setCode("BUSINESS");
        plan.setNameRu("Бизнес");
        lenient().when(planRepository.findById(9L)).thenReturn(Optional.of(plan));

        lenient().when(entitlementService.enabledFeatures(anyLong(), anyLong())).thenReturn(Set.of(FeatureCode.DOCUMENT_FLOW));
        lenient().when(usageLimitService.effectiveLimit(anyLong(), any())).thenReturn(100L);
        lenient().when(usageRepository.findCurrent(anyLong(), any())).thenReturn(Optional.empty());
    }

    private OrganizationSubscription subscriptionWith(SubscriptionStatus status) {
        OrganizationSubscription sub = new OrganizationSubscription();
        sub.setId(50L);
        sub.setOrganizationId(ORG_ID);
        sub.setPlanId(9L);
        sub.setStatus(status);
        sub.setStartsAt(LocalDateTime.now().minusDays(10));
        sub.setExpiresAt(LocalDateTime.now().plusDays(5));
        sub.setGraceEndsAt(LocalDateTime.now().plusDays(10));
        sub.setSuspensionReason("тест приостановки");
        return sub;
    }

    private void mockSubscription(Optional<OrganizationSubscription> subscription) {
        lenient().when(subscriptionRepository.findCurrentNonTerminal(anyLong(), any())).thenReturn(subscription);
        // A Mockito @Mock stubs default interface methods directly too (it never falls through to
        // the real default-method body), so findMostRecent - used by requireWriteAccess/
        // requireActiveAccess to still find EXPIRED/CANCELLED rows that findCurrentNonTerminal
        // deliberately excludes - needs its own explicit stub here, not just findByOrganizationId.
        lenient().when(subscriptionRepository.findMostRecent(anyLong())).thenReturn(subscription);
    }

    @Test
    void activeStatus_fullWriteAccess_notReadOnly() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.ACTIVE)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertFalse(context.readOnly());
        assertTrue(context.canOpenModule());
        assertNull(context.reason());
        assertDoesNotThrow(() -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void trialStatus_fullWriteAccess_notReadOnly() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.TRIAL)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertFalse(context.readOnly());
        assertTrue(context.canOpenModule());
        assertDoesNotThrow(() -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void gracePeriodStatus_stillWritable_butCarriesWarningReason() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.GRACE_PERIOD)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertFalse(context.readOnly());
        assertNotNull(context.reason());
        assertDoesNotThrow(() -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void expiredStatus_readOnly_writeThrowsButActiveAccessSucceeds() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.EXPIRED)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertDoesNotThrow(() -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowReadOnlyException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void cancelledStatus_readOnly_writeThrowsButActiveAccessSucceeds() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.CANCELLED)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertDoesNotThrow(() -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowReadOnlyException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void suspendedStatus_closedEntirely_bothRequireMethodsThrow() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.SUSPENDED)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertFalse(context.canOpenModule());
        assertThrows(DocumentFlowAccessSuspendedException.class, () -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowAccessSuspendedException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void pendingStatus_closedEntirely_bothRequireMethodsThrow() {
        mockSubscription(Optional.of(subscriptionWith(SubscriptionStatus.PENDING)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertFalse(context.canOpenModule());
        assertThrows(DocumentFlowSubscriptionRequiredException.class, () -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowSubscriptionRequiredException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void noSubscriptionAtAll_closedEntirely_bothRequireMethodsThrow() {
        mockSubscription(Optional.empty());
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertFalse(context.canOpenModule());
        assertThrows(DocumentFlowSubscriptionRequiredException.class, () -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowSubscriptionRequiredException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void noSubscription_testModeAllowlisted_grantsAccessAsTestOverride() {
        mockSubscription(Optional.empty());
        testAccessProperties.getAccess().setTestModeEnabled(true);
        testAccessProperties.getAccess().setAllowedUserIds(Set.of(USER_ID));
        testAccessProperties.getAccess().setAllowedOrganizationIds(Set.of(ORG_ID));

        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.canOpenModule());
        assertTrue(context.testOverride());
        assertFalse(context.readOnly());
        // The role's own permissions are used unchanged - test mode never elevates them.
        assertEquals(MembershipRole.DOCUMENT_MANAGER.defaultPermissions(), context.permissions());
        assertDoesNotThrow(() -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertDoesNotThrow(() -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void noSubscription_testModeEnabled_butOrgNotAllowlisted_stillDenied() {
        mockSubscription(Optional.empty());
        testAccessProperties.getAccess().setTestModeEnabled(true);
        testAccessProperties.getAccess().setAllowedUserIds(Set.of(USER_ID));
        testAccessProperties.getAccess().setAllowedOrganizationIds(Set.of(999L)); // a different org

        assertThrows(DocumentFlowSubscriptionRequiredException.class, () -> service.requireActiveAccess(USER_ID, ORG_ID));
    }

    @Test
    void testModeAllowlisted_doesNotGrantMembershipItself_strangerStillDenied() {
        testAccessProperties.getAccess().setTestModeEnabled(true);
        Long strangerUserId = 999L;
        testAccessProperties.getAccess().setAllowedUserIds(Set.of(strangerUserId));
        testAccessProperties.getAccess().setAllowedOrganizationIds(Set.of(ORG_ID));
        when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, strangerUserId)).thenReturn(Optional.empty());

        // Allowlisted user+org, but no real membership row - test mode must not substitute for it.
        assertThrows(DocumentFlowMembershipRequiredException.class, () -> service.requireActiveAccess(strangerUserId, ORG_ID));
    }

    @Test
    void noSubscription_allowlistedByEmail_grantsAccess() {
        mockSubscription(Optional.empty());
        testAccessProperties.getAccess().setTestModeEnabled(true);
        testAccessProperties.getAccess().setAllowedEmails(Set.of("admin@ecoprogress.kz"));
        testAccessProperties.getAccess().setAllowedOrganizationIds(Set.of(ORG_ID));
        User user = new User();
        user.setEmail("admin@ecoprogress.kz");
        lenient().when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.canOpenModule());
        assertTrue(context.testOverride());
    }

    /** Tenant isolation / IDOR guard: a user with NO membership row in the target organization at
     *  all must never get write access, regardless of that organization's subscription state. */
    @Test
    void noMembershipAtAll_requireWriteAccess_throwsMembershipRequired() {
        Long strangerUserId = 999L;
        when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, strangerUserId)).thenReturn(Optional.empty());

        assertThrows(DocumentFlowMembershipRequiredException.class, () -> service.requireWriteAccess(strangerUserId, ORG_ID));
        assertThrows(DocumentFlowMembershipRequiredException.class, () -> service.requireActiveAccess(strangerUserId, ORG_ID));
    }

    /** Module spec §5: INVITED/SUSPENDED memberships must be denied just like REMOVED -
     *  previously requireActiveAccess/requireWriteAccess only excluded REMOVED, so a not-yet-
     *  accepted or suspended member still got access as long as the subscription was fine. */
    @ParameterizedTest
    @EnumSource(value = MembershipStatus.class, names = {"INVITED", "SUSPENDED", "REMOVED"})
    void nonActiveMembership_isDeniedByBothRequireMethods(MembershipStatus status) {
        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setId(6L);
        membership.setOrganizationId(ORG_ID);
        membership.setUserId(USER_ID);
        membership.setRoleCode(MembershipRole.DOCUMENT_MANAGER);
        membership.setStatus(status);
        when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, USER_ID)).thenReturn(Optional.of(membership));

        assertThrows(DocumentFlowMembershipRequiredException.class, () -> service.requireActiveAccess(USER_ID, ORG_ID));
        assertThrows(DocumentFlowMembershipRequiredException.class, () -> service.requireWriteAccess(USER_ID, ORG_ID));
    }

    @Test
    void requirePermission_activeMembershipWithPermission_succeeds() {
        // setUp()'s default membership is DOCUMENT_MANAGER, ACTIVE - MANAGE_MEMBERS is an
        // OWNER-only permission, VIEW_DOCUMENTS is granted to every role.
        assertDoesNotThrow(() -> service.requirePermission(USER_ID, ORG_ID, DocumentFlowPermission.VIEW_DOCUMENTS));
    }

    @Test
    void requirePermission_activeMembershipWithoutPermission_throwsAccessDenied() {
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> service.requirePermission(USER_ID, ORG_ID, DocumentFlowPermission.MANAGE_SUBSCRIPTION));
    }

    /** The exact IDOR scenario from the audit: a user from a completely different organization
     *  must never pass a permission check for org ORG_ID just because SOME membership exists. */
    @Test
    void requirePermission_noMembershipInThisOrganization_throwsMembershipRequired_notAccessDenied() {
        Long strangerUserId = 999L;
        when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, strangerUserId)).thenReturn(Optional.empty());

        assertThrows(DocumentFlowMembershipRequiredException.class,
                () -> service.requirePermission(strangerUserId, ORG_ID, DocumentFlowPermission.VIEW_DOCUMENTS));
    }

    /** Regression for the getAccessContext bug: previously it queried findCurrentNonTerminal
     *  (which excludes EXPIRED/CANCELLED), so an EXPIRED organization looked identical to one that
     *  never had a subscription at all ("Нет активной подписки"). It must instead surface the
     *  EXPIRED row as read-only with its own distinct reason, exactly like requireWriteAccess
     *  already did via findMostRecent. */
    @Test
    void getAccessContext_expiredSubscription_isDistinguishedFromNeverSubscribed() {
        OrganizationSubscription expired = subscriptionWith(SubscriptionStatus.EXPIRED);
        lenient().when(subscriptionRepository.findCurrentNonTerminal(anyLong(), any())).thenReturn(Optional.empty());
        lenient().when(subscriptionRepository.findMostRecent(anyLong())).thenReturn(Optional.of(expired));

        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertEquals(SubscriptionStatus.EXPIRED, context.subscriptionStatus());
        assertNotEquals("Нет активной подписки на модуль документооборота", context.reason());
        assertTrue(context.canOpenModule());
    }

    @Test
    void getAccessContext_cancelledSubscription_isReadOnlyNotClosed() {
        OrganizationSubscription cancelled = subscriptionWith(SubscriptionStatus.CANCELLED);
        lenient().when(subscriptionRepository.findCurrentNonTerminal(anyLong(), any())).thenReturn(Optional.empty());
        lenient().when(subscriptionRepository.findMostRecent(anyLong())).thenReturn(Optional.of(cancelled));

        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertTrue(context.readOnly());
        assertEquals(SubscriptionStatus.CANCELLED, context.subscriptionStatus());
        assertTrue(context.canOpenModule());
    }

    @ParameterizedTest
    @EnumSource(SubscriptionStatus.class)
    void everyStatus_producesANonNullAccessContext(SubscriptionStatus status) {
        mockSubscription(Optional.of(subscriptionWith(status)));
        AccessContext context = service.getAccessContext(USER_ID, ORG_ID);
        assertNotNull(context);
        assertEquals(status, context.subscriptionStatus());
    }
}
