package kz.ecoprogress.documentflow.admin;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import kz.eco.user.ClientType;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.admin.dto.AccessGrantRequest;
import kz.ecoprogress.documentflow.admin.dto.AdminOrganizationAccessDto;
import kz.ecoprogress.documentflow.admin.dto.EntitlementsRequest;
import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlement;
import kz.ecoprogress.documentflow.entitlement.OrganizationEntitlementRepository;
import kz.ecoprogress.documentflow.entitlement.EntitlementSource;
import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverride;
import kz.ecoprogress.documentflow.entitlement.OrganizationPlanOverrideRepository;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowNotificationOutboxService;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.membership.MembershipInvitationService;
import kz.ecoprogress.documentflow.membership.MembershipInvitationRepository;
import kz.ecoprogress.documentflow.membership.MembershipInvitationStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.SubscriptionEventType;
import kz.ecoprogress.documentflow.subscription.SubscriptionService;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.usage.UsageLimitService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
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
    private final UsageLimitService usageLimitService;
    private final UserRepository userRepository;
    private final kz.ecoprogress.documentflow.subscription.SubscriptionEventRepository eventRepository;
    private final MembershipInvitationService invitationService;
    private final MembershipInvitationRepository invitationRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public AdminSubscriptionService(CompanyRepository companyRepository,
                                     SubscriptionPlanRepository planRepository,
                                     SubscriptionService subscriptionService,
                                     OrganizationPlanOverrideRepository overrideRepository,
                                     OrganizationEntitlementRepository entitlementRepository,
                                     AuditLogService auditLogService,
                                     DocumentFlowNotificationOutboxService notificationOutboxService,
                                     DocumentFlowMembershipRepository membershipRepository,
                                     DocumentFlowAccessService accessService,
                                     UsageLimitService usageLimitService,
                                     UserRepository userRepository,
                                     kz.ecoprogress.documentflow.subscription.SubscriptionEventRepository eventRepository,
                                     MembershipInvitationService invitationService,
                                     MembershipInvitationRepository invitationRepository,
                                     org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.companyRepository = companyRepository;
        this.planRepository = planRepository;
        this.subscriptionService = subscriptionService;
        this.overrideRepository = overrideRepository;
        this.entitlementRepository = entitlementRepository;
        this.auditLogService = auditLogService;
        this.notificationOutboxService = notificationOutboxService;
        this.membershipRepository = membershipRepository;
        this.accessService = accessService;
        this.usageLimitService = usageLimitService;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.invitationService = invitationService;
        this.invitationRepository = invitationRepository;
        this.passwordEncoder = passwordEncoder;
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
    public AdminOrganizationAccessDto grantAccess(AccessGrantRequest request, User actor) {
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

        if (request.initialOwnerUserId() != null) {
            assignOwner(request.organizationId(), request.initialOwnerUserId(), actor);
        } else if (request.ownerEmail() != null && !request.ownerEmail().isBlank()) {
            provisionOwnerByEmail(request.organizationId(), request.ownerEmail(), request.ownerFullName(), actor);
        }

        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", subscription.getId(), null, actor,
                "ACCESS_GRANTED", null, plan.getCode(), request.reason());

        notifyOrganization(request.organizationId(), "Доступ к модулю \"Документооборот\" предоставлен",
                "Организации предоставлен доступ по плану " + plan.getNameRu());

        return buildOrgAccessDto(request.organizationId());
    }

    private void provisionOwnerByEmail(Long organizationId, String email, String fullName, User actor) {
        String normalized = email.trim().toLowerCase(java.util.Locale.ROOT);
        User user = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
        boolean created = user == null;
        if (created) {
            user = new User(); user.setEmail(normalized); user.setName(fullName != null ? fullName.trim() : normalized);
            user.setPasswordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
            user.setRole(UserRole.CLIENT); user.setType(ClientType.company); user.setStatus(UserStatus.active);
            user = userRepository.save(user);
        }
        DocumentFlowMembership membership = membershipRepository.findByOrganizationIdAndUserId(organizationId, user.getId())
                .orElseGet(DocumentFlowMembership::new);
        membership.setOrganizationId(organizationId); membership.setUserId(user.getId());
        membership.setRoleCode(MembershipRole.OWNER); membership.setInvitedBy(actor.getId());
        membership.setStatus(created ? MembershipStatus.INVITED : MembershipStatus.ACTIVE);
        if (!created && membership.getJoinedAt() == null) membership.setJoinedAt(java.time.LocalDateTime.now());
        membership = membershipRepository.save(membership);
        if (created) {
            MembershipInvitationService.Created invitation = invitationService.create(membership, user, actor.getId());
            notificationOutboxService.enqueue(user.getId(), organizationId, "Приглашение в документооборот",
                    "Установите пароль по одноразовой ссылке /api/public/document-flow/invitations/"
                            + invitation.rawToken() + "/accept", "DOCUMENT_FLOW_MEMBERSHIP_INVITATION");
        }
    }

    /**
     * Create-or-activate-or-promote-to-OWNER for the grant flow's optional
     * {@code initialOwnerUserId} (task item 9), in the same transaction as the subscription grant
     * so a replayed idempotent request sees consistent membership state too:
     * <ul>
     *   <li>no membership row yet for (organizationId, userId) -&gt; create one, ACTIVE, OWNER.</li>
     *   <li>row exists but not OWNER -&gt; promote to OWNER (and reactivate if not ACTIVE).</li>
     *   <li>row exists and already ACTIVE OWNER -&gt; no-op (idempotent replay safe).</li>
     * </ul>
     */
    private void assignOwner(Long organizationId, Long userId, User actor) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("Пользователь для назначения владельцем не найден", "USER_NOT_FOUND");
        }
        DocumentFlowMembership membership = membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseGet(() -> {
                    DocumentFlowMembership created = new DocumentFlowMembership();
                    created.setOrganizationId(organizationId);
                    created.setUserId(userId);
                    created.setInvitedBy(actor.getId());
                    return created;
                });
        boolean isNew = membership.getId() == null;
        MembershipRole previousRole = membership.getRoleCode();
        MembershipStatus previousStatus = membership.getStatus();
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        if (membership.getJoinedAt() == null) {
            membership.setJoinedAt(java.time.LocalDateTime.now());
        }
        membershipRepository.save(membership);

        if (isNew) {
            auditLogService.log("DocumentFlowMembership", membership.getId(), null, actor,
                    "OWNER_ASSIGNED", null, MembershipRole.OWNER.name(), "Назначен владелец при выдаче доступа");
        } else if (previousRole != MembershipRole.OWNER || previousStatus != MembershipStatus.ACTIVE) {
            auditLogService.log("DocumentFlowMembership", membership.getId(), null, actor,
                    "OWNER_ASSIGNED", previousRole != null ? previousRole.name() : null,
                    MembershipRole.OWNER.name(), "Назначен владелец при выдаче доступа");
        }
    }

    @Transactional
    public AdminOrganizationAccessDto extend(Long organizationId, java.time.LocalDateTime newExpiresAt, String reason, User actor, Long expectedVersion) {
        subscriptionService.extend(organizationId, newExpiresAt, actor.getId(), reason, expectedVersion);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "EXTENDED", null, String.valueOf(newExpiresAt), reason);
        notifyOrganization(organizationId, "Подписка продлена", "Подписка продлена до " + newExpiresAt);
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto suspend(Long organizationId, String reason, User actor, Long expectedVersion) {
        subscriptionService.suspend(organizationId, actor.getId(), reason, expectedVersion);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "SUSPENDED", null, null, reason);
        notifyOrganization(organizationId, "Доступ приостановлен", reason);
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto restore(Long organizationId, String reason, User actor, Long expectedVersion) {
        subscriptionService.restore(organizationId, actor.getId(), reason, expectedVersion);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "RESTORED", null, null, reason);
        notifyOrganization(organizationId, "Доступ восстановлен", reason);
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto revoke(Long organizationId, String reason, User actor, Long expectedVersion) {
        subscriptionService.revoke(organizationId, actor.getId(), reason, expectedVersion);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "REVOKED", null, null, reason);
        notifyOrganization(organizationId, "Доступ отозван", reason);
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto changePlan(Long organizationId, String planCode, String reason, User actor, Long expectedVersion) {
        SubscriptionPlan plan = planRepository.findByCode(planCode)
                .orElseThrow(() -> new NotFoundException("Тарифный план не найден", "PLAN_NOT_FOUND"));
        if (!plan.isActive()) {
            throw new BadRequestException("Тарифный план не активен", "PLAN_NOT_ACTIVE");
        }
        subscriptionService.changePlan(organizationId, plan.getId(), actor.getId(), reason, expectedVersion);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "PLAN_CHANGED", null, plan.getCode(), reason);
        notifyOrganization(organizationId, "Тарифный план изменён", "Новый план: " + plan.getNameRu());
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto updateLimits(Long organizationId, Map<UsageMetric, Long> limits,
                                       java.time.LocalDateTime startsAt, java.time.LocalDateTime expiresAt,
                                       String reason, User actor, Long expectedVersion) {
        OrganizationSubscription subscription = subscriptionService.checkVersionAndGet(organizationId, expectedVersion);
        for (Map.Entry<UsageMetric, Long> entry : limits.entrySet()) {
            createOverride(organizationId, entry.getKey(), entry.getValue(), reason, actor.getId(), startsAt, expiresAt);
        }
        subscriptionService.appendEvent(subscription, SubscriptionEventType.LIMIT_CHANGED,
                subscription.getStatus(), subscription.getStatus(), reason, actor.getId(), null);
        auditLogService.log("DOCUMENT_FLOW_SUBSCRIPTION", organizationId, null, actor, "LIMITS_CHANGED", null, limits.toString(), reason);
        notifyOrganization(organizationId, "Лимиты изменены", reason);
        return buildOrgAccessDto(organizationId);
    }

    @Transactional
    public AdminOrganizationAccessDto updateEntitlements(Long organizationId, EntitlementsRequest request, User actor) {
        OrganizationSubscription subscription = subscriptionService.checkVersionAndGet(organizationId, request.expectedVersion());
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        for (EntitlementsRequest.EntitlementInput input : request.entitlements()) {
            // Same close-out-before-insert rule as createOverride: without this, a previous
            // ENTITLEMENT_GRANTED row for the same feature never gets closed out, so two rows can
            // both read as "currently active" for the same organization+featureCode at once.
            for (OrganizationEntitlement previous : entitlementRepository.findByOrganizationIdAndFeatureCode(organizationId, input.featureCode())) {
                if (previous.isCurrentlyActive(now)) {
                    previous.setExpiresAt(now);
                    entitlementRepository.save(previous);
                }
            }

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
        return buildOrgAccessDto(organizationId);
    }

    @Transactional(readOnly = true)
    public List<OrganizationSubscription> listAll() {
        return subscriptionService.findAll();
    }

    /** GET .../subscriptions/{organizationId}/events (task item 11/15). */
    @Transactional(readOnly = true)
    public kz.eco.common.PageResponse<kz.ecoprogress.documentflow.admin.dto.SubscriptionEventAdminDto> listEvents(
            Long organizationId, kz.ecoprogress.documentflow.subscription.SubscriptionEventType eventType,
            java.time.LocalDateTime from, java.time.LocalDateTime to, org.springframework.data.domain.Pageable pageable) {
        if (!companyRepository.existsById(organizationId)) {
            throw new NotFoundException("Организация не найдена", "ORGANIZATION_NOT_FOUND");
        }
        org.springframework.data.domain.Page<kz.ecoprogress.documentflow.subscription.SubscriptionEvent> page;
        if (eventType != null && from != null && to != null) {
            page = eventRepository.findByOrganizationIdAndEventTypeAndCreatedAtBetween(organizationId, eventType, from, to, pageable);
        } else if (eventType != null) {
            page = eventRepository.findByOrganizationIdAndEventType(organizationId, eventType, pageable);
        } else if (from != null && to != null) {
            page = eventRepository.findByOrganizationIdAndCreatedAtBetween(organizationId, from, to, pageable);
        } else {
            page = eventRepository.findByOrganizationId(organizationId, pageable);
        }
        return kz.eco.common.PageResponse.of(page, kz.ecoprogress.documentflow.admin.dto.SubscriptionEventAdminDto::from);
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
        String metricTag = feature == FeatureCode.CUSTOM_LIMITS ? metric.name() : null;

        // Close out any still-active previous override for this exact (organizationId, feature,
        // metric) scope before inserting the new one - otherwise the previous row keeps reading as
        // "currently active" (isCurrentlyActive) forever alongside the new one, and callers that
        // resolve "the" effective limit get an ambiguous/stale value depending on iteration order.
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        for (OrganizationPlanOverride previous : overrideRepository.findByOrganizationIdAndFeatureCodeAndMetric(organizationId, feature, metricTag)) {
            if (previous.isCurrentlyActive(now)) {
                previous.setExpiresAt(now);
                overrideRepository.save(previous);
            }
        }

        OrganizationPlanOverride override = new OrganizationPlanOverride();
        override.setOrganizationId(organizationId);
        override.setFeatureCode(feature);
        override.setLimitValue(limitValue);
        override.setMetric(metricTag);
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
    public AdminOrganizationAccessDto getAccessContextForOrganization(Long organizationId) {
        return buildOrgAccessDto(organizationId);
    }

    /** GET /api/admin/document-flow/access/{organizationId} (task item 4/12): 200 with the
     *  {@code hasSubscription:false} shape for an organization that has never had a subscription -
     *  404 only if the organization itself doesn't exist. */
    @Transactional(readOnly = true)
    public AdminOrganizationAccessDto getOrganizationAccessDetail(Long organizationId) {
        if (!companyRepository.existsById(organizationId)) {
            throw new NotFoundException("Организация не найдена", "ORGANIZATION_NOT_FOUND");
        }
        return buildOrgAccessDto(organizationId);
    }

    /**
     * Builds an organization-centric {@link AdminOrganizationAccessDto} directly from the
     * organization's own most-recent subscription row - NOT from an arbitrary member's
     * {@link AccessContext} the way the old {@code contextForOrganization} did. That previous
     * implementation picked "the organization's first membership found by an unordered query" (in
     * practice whichever row the DB happened to return first) and returned THAT user's per-user
     * AccessContext as if it described the organization; two admins hitting the same endpoint for
     * the same organization could get different {@code reason}/permission-shaped data depending on
     * which membership row won the race, and an organization with zero memberships (freshly
     * created, before any OWNER was assigned) produced a context for a null user with no
     * subscription info populated at all even though a real subscription row existed. This method
     * never depends on which membership exists or who happens to hold it.
     */
    private AdminOrganizationAccessDto buildOrgAccessDto(Long organizationId) {
        long activeMemberCount = membershipRepository.countByOrganizationIdAndStatus(organizationId, MembershipStatus.ACTIVE);
        boolean hasOwner = membershipRepository.existsByOrganizationIdAndStatusAndRoleCode(
                organizationId, MembershipStatus.ACTIVE, MembershipRole.OWNER);

        return subscriptionService.findMostRecent(organizationId)
                .map(subscription -> {
                    SubscriptionPlan plan = planRepository.findById(subscription.getPlanId()).orElse(null);
                    boolean readOnly;
                    boolean available;
                    String reason;
                    switch (subscription.getStatus()) {
                        case ACTIVE, TRIAL -> {
                            available = true;
                            readOnly = false;
                            reason = null;
                        }
                        case GRACE_PERIOD -> {
                            available = true;
                            readOnly = false;
                            reason = "Действует льготный период";
                        }
                        case EXPIRED -> {
                            available = true;
                            readOnly = true;
                            reason = "Подписка истекла — доступ только для чтения";
                        }
                        case CANCELLED -> {
                            available = true;
                            readOnly = true;
                            reason = "Доступ отозван — документы доступны только для чтения";
                        }
                        case SUSPENDED -> {
                            available = false;
                            readOnly = true;
                            reason = subscription.getSuspensionReason() != null
                                    ? subscription.getSuspensionReason() : "Доступ приостановлен администратором";
                        }
                        default -> {
                            available = false;
                            readOnly = true;
                            reason = "Подписка ожидает активации";
                        }
                    }

                    Map<UsageMetric, Long> limits = new EnumMap<>(UsageMetric.class);
                    for (UsageMetric metric : UsageMetric.values()) {
                        limits.put(metric, usageLimitService.effectiveLimit(organizationId, metric));
                    }

                    DocumentFlowMembership owner = membershipRepository.findByOrganizationIdAndStatusNot(
                                    organizationId, MembershipStatus.REMOVED).stream()
                            .filter(m -> m.getRoleCode() == MembershipRole.OWNER).findFirst().orElse(null);
                    Long invitationId = owner == null ? null : invitationRepository
                            .findFirstByOrganizationIdAndUserIdAndStatusOrderByCreatedAtDesc(
                                    organizationId, owner.getUserId(), MembershipInvitationStatus.INVITED)
                            .map(kz.ecoprogress.documentflow.membership.MembershipInvitation::getId).orElse(null);
                    return AdminOrganizationAccessDto.from(subscription, plan, available, readOnly, reason,
                            activeMemberCount, hasOwner, limits, Map.of(), owner != null ? owner.getUserId() : null,
                            owner != null ? owner.getId() : null, invitationId);
                })
                .orElseGet(() -> AdminOrganizationAccessDto.noSubscription(organizationId, activeMemberCount, hasOwner));
    }
}
