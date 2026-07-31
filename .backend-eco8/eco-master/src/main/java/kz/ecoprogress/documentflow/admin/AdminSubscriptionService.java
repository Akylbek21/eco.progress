package kz.ecoprogress.documentflow.admin;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.admin.dto.AccessGrantRequest;
import kz.ecoprogress.documentflow.admin.dto.EntitlementsRequest;
import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlement;
import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlementRepository;
import kz.ecoprogress.documentflow.entitlement.EntitlementSource;
import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverride;
import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverrideRepository;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowNotificationOutboxService;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.SubscriptionEventType;
import kz.ecoprogress.documentflow.subscription.SubscriptionService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Business logic behind every {@code /api/admin/document-flow/subscriptions/**} and
 * {@code /api/admin/document-flow/access-grants} endpoint. {@link #grantAccess} implements the
 * full 11-step scenario from the module spec end to end.
 */
@Service
public class AdminSubscriptionService {

    private final CompanyRepository companyRepository;
    private final SubscriptionPlanRepository planRepository;
    private final SubscriptionService subscriptionService;
    private final OrganizationPlanOverrideRepository overrideRepository;
    private final OrganizationEntitlementRepository entitlementRepository;
    private final AuditLogService auditLogService;
    private final DocumentFlowNotificationOutboxService notificationOutboxService;
    private final DocumentFlowMembershipRepository membershipRepository;
    private final DocumentFlowAccessService accessService;

    public AdminSubscriptionService(CompanyRepository companyRepository,
                                     SubscriptionPlanRepository planRepository,
                                     SubscriptionService subscriptionService,
                                     OrganizationPlanOverrideRepository overrideRepository,
                                     OrganizationEntitlementRepository entitlementRepository,
                                     AuditLogService auditLogService,
                                     DocumentFlowNotificationOutboxService notificationOutboxService,
                                     DocumentFlowMembershipRepository membershipRepository,
                                     DocumentFlowAccessService accessService) {
        this.companyRepository = companyRepository;
        this.planRepository = planRepository;
        this.subscriptionService = subscriptionService;
        this.overrideRepository = overrideRepository;
        this.entitlementRepository = entitlementRepository;
        this.auditLogService = auditLogService;
        this.notificationOutboxService = notificationOutboxService;
        this.membershipRepository = membershipRepository;
        this.accessService = accessService;
    }

    /**
     * Steps (per module spec point 10):
     *  1. admin permission - enforced by @PreAuthorize on the controller, not here.
     *  2. organization exists.
     *  3. plan exists + active.
     *  4. dates valid.
     *  5-6. find-and-update-or-create the org's ACTIVE subscription (SubscriptionService keeps
     *       this to at most one non-terminal row).
     *  7. create organization_plan_overrides rows for any limits in the request.
     *  8. subscription_events row (appended inside SubscriptionService.grantOrUpdateActive).
     *  9. audit log entry.
     *  10. outbox notification for every member of the organization.
     *  11. return the fresh AccessContext.
     */
    @Transactional
    public AccessContext grantAccess(AccessGrantRequest request, User actor) {
        if (!companyRepository.existsById(request.organizationId())) {
            throw new NotFoundException("Организация не найдена", "ORGANIZATION_NOT_FOUND");
        }
        SubscriptionPlan plan = planRepository.findByCode(request.planCode())
                .orElseThrow(() -> new NotFoundException("Тарифный план не найден", "PLAN_NOT_FOUND"));
        if (!plan.isActive()) {
            throw new BadRequestException("Тарифный план не активен", "PLAN_NOT_ACTIVE");
        }
        if (request.expiresAt() != null && request.expiresAt().isBefore(request.startsAt())) {
            throw new BadRequestException("Дата окончания раньше даты начала", "INVALID_DATE_RANGE");
        }

        OrganizationSubscription subscription = subscriptionService.grantOrUpdateActive(
                request.organizationId(), plan.getId(), request.startsAt(), request.expiresAt(),
                request.paymentMode(), request.paymentReference(), actor.getId(), request.reason());

        if (request.expiresAt() != null) {
            subscription.setGraceEndsAt(request.graceEndsAt());
        }

        if (request.limits() != null) {
            for (Map.Entry<UsageMetric, Long> entry : request.limits().entrySet()) {
                createOverride(request.organizationId(), entry.getKey(), entry.getValue(), request.reason(), actor.getId());
            }
        }

        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", subscription.getId(), null, actor,
                "ACCESS_GRANTED", null, plan.getCode(), request.reason());

        notifyOrganization(request.organizationId(), "Доступ к модулю \"Документооборот\" предоставлен",
                "Организации предоставлен доступ по плану " + plan.getNameRu());

        return contextForOrganization(request.organizationId());
    }

    @Transactional
    public AccessContext extend(Long organizationId, java.time.LocalDateTime newExpiresAt, String reason, User actor) {
        subscriptionService.extend(organizationId, newExpiresAt, actor.getId(), reason);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "EXTENDED", null, String.valueOf(newExpiresAt), reason);
        notifyOrganization(organizationId, "Подписка продлена", "Подписка продлена до " + newExpiresAt);
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext suspend(Long organizationId, String reason, User actor) {
        subscriptionService.suspend(organizationId, actor.getId(), reason);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "SUSPENDED", null, null, reason);
        notifyOrganization(organizationId, "Доступ приостановлен", reason);
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext restore(Long organizationId, String reason, User actor) {
        subscriptionService.restore(organizationId, actor.getId(), reason);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "RESTORED", null, null, reason);
        notifyOrganization(organizationId, "Доступ восстановлен", reason);
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext revoke(Long organizationId, String reason, User actor) {
        subscriptionService.revoke(organizationId, actor.getId(), reason);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "REVOKED", null, null, reason);
        notifyOrganization(organizationId, "Доступ отозван", reason);
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext changePlan(Long organizationId, String planCode, String reason, User actor) {
        SubscriptionPlan plan = planRepository.findByCode(planCode)
                .orElseThrow(() -> new NotFoundException("Тарифный план не найден", "PLAN_NOT_FOUND"));
        if (!plan.isActive()) {
            throw new BadRequestException("Тарифный план не активен", "PLAN_NOT_ACTIVE");
        }
        subscriptionService.changePlan(organizationId, plan.getId(), actor.getId(), reason);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "PLAN_CHANGED", null, plan.getCode(), reason);
        notifyOrganization(organizationId, "Тарифный план изменён", "Новый план: " + plan.getNameRu());
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext updateLimits(Long organizationId, Map<UsageMetric, Long> limits,
                                       java.time.LocalDateTime startsAt, java.time.LocalDateTime expiresAt,
                                       String reason, User actor) {
        OrganizationSubscription subscription = subscriptionService.getByOrganizationOrThrow(organizationId);
        for (Map.Entry<UsageMetric, Long> entry : limits.entrySet()) {
            createOverride(organizationId, entry.getKey(), entry.getValue(), reason, actor.getId(), startsAt, expiresAt);
        }
        subscriptionService.appendEvent(subscription, SubscriptionEventType.LIMIT_CHANGED,
                subscription.getStatus(), subscription.getStatus(), reason, actor.getId(), null);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "LIMITS_CHANGED", null, limits.toString(), reason);
        notifyOrganization(organizationId, "Лимиты изменены", reason);
        return contextForOrganization(organizationId);
    }

    @Transactional
    public AccessContext updateEntitlements(Long organizationId, EntitlementsRequest request, User actor) {
        OrganizationSubscription subscription = subscriptionService.getByOrganizationOrThrow(organizationId);
        for (EntitlementsRequest.EntitlementInput input : request.entitlements()) {
            OrganizationEntitlement entitlement = new OrganizationEntitlement();
            entitlement.setOrganizationId(organizationId);
            entitlement.setFeatureCode(input.featureCode());
            entitlement.setEnabled(input.enabled());
            entitlement.setStartsAt(input.startsAt());
            entitlement.setExpiresAt(input.expiresAt());
            entitlement.setSource(EntitlementSource.ADMIN);
            entitlement.setReason(input.reason());
            entitlement.setGrantedBy(actor.getId());
            entitlementRepository.save(entitlement);

            subscriptionService.appendEvent(subscription,
                    input.enabled() ? SubscriptionEventType.ENTITLEMENT_GRANTED : SubscriptionEventType.ENTITLEMENT_REVOKED,
                    subscription.getStatus(), subscription.getStatus(), input.reason(), actor.getId(), null);
        }
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "ENTITLEMENTS_CHANGED", null, null, null);
        notifyOrganization(organizationId, "Доступные функции изменены", "Администратор изменил набор функций модуля");
        return contextForOrganization(organizationId);
    }

    @Transactional(readOnly = true)
    public List<OrganizationSubscription> listAll() {
        return subscriptionService.findAll();
    }

    @Transactional(readOnly = true)
    public OrganizationSubscription getByOrganization(Long organizationId) {
        return subscriptionService.getByOrganizationOrThrow(organizationId);
    }

    private void createOverride(Long organizationId, UsageMetric metric, Long limitValue, String reason, Long actorUserId) {
        createOverride(organizationId, metric, limitValue, reason, actorUserId, null, null);
    }

    private void createOverride(Long organizationId, UsageMetric metric, Long limitValue, String reason, Long actorUserId,
                                 java.time.LocalDateTime startsAt, java.time.LocalDateTime expiresAt) {
        FeatureCode feature = metric.limitFeature();
        OrganizationPlanOverride override = new OrganizationPlanOverride();
        override.setOrganizationId(organizationId);
        override.setFeatureCode(feature);
        override.setLimitValue(limitValue);
        if (feature == FeatureCode.CUSTOM_LIMITS) {
            override.setMetric(metric.name());
        }
        override.setStartsAt(startsAt);
        override.setExpiresAt(expiresAt);
        override.setReason(reason);
        override.setGrantedBy(actorUserId);
        overrideRepository.save(override);
    }

    private void notifyOrganization(Long organizationId, String title, String message) {
        List<DocumentFlowMembership> members = membershipRepository.findByOrganizationIdAndStatus(organizationId, MembershipStatus.ACTIVE);
        for (DocumentFlowMembership member : members) {
            notificationOutboxService.enqueue(member.getUserId(), organizationId, title, message, "DOCUMENT_FLOW_SUBSCRIPTION");
        }
    }

    @Transactional(readOnly = true)
    public AccessContext getAccessContextForOrganization(Long organizationId) {
        return contextForOrganization(organizationId);
    }

    /** Builds the AccessContext for the organization's first membership (its OWNER, in practice) -
     *  admin endpoints describe organization-level state, not one particular user's view, but
     *  AccessContext is inherently per-user (permissions/membershipId); using the org's own
     *  earliest membership is the closest reasonable proxy. Falls back to a null-user (empty)
     *  context if the organization somehow has no membership rows yet. */
    private AccessContext contextForOrganization(Long organizationId) {
        return membershipRepository.findByOrganizationIdAndStatusNot(organizationId, MembershipStatus.REMOVED).stream()
                .findFirst()
                .map(m -> accessService.getAccessContext(m.getUserId(), organizationId))
                .orElseGet(() -> accessService.getAccessContext(null, organizationId));
    }
}
