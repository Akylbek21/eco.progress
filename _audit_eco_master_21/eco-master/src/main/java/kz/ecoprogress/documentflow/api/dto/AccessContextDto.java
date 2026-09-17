package kz.ecoprogress.documentflow.api.dto;

import kz.eco.company.Company;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Exact response shape for GET /api/document-flow/access (ticket point 9; internal-mode fields
 *  per the internal-rollout module spec §4). */
public record AccessContextDto(
        boolean available,
        boolean readOnly,
        boolean internalMode,
        String status,
        /** Module spec §4: the resolved active tenant, flat and unambiguous - additive alongside
         *  {@code organization.id} (kept for backward compatibility with existing callers). */
        Long organizationId,
        MembershipRole role,
        MembershipStatus membershipStatus,
        OrganizationDto organization,
        PlanDto plan,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        Long daysRemaining,
        Set<FeatureCode> features,
        List<String> permissions,
        Map<UsageMetric, Long> limits,
        Map<UsageMetric, Long> usage,
        List<String> availableActions,
        String reason,
        boolean testMode
) {
    public record PlanDto(String code, String name) {
    }

    public record OrganizationDto(Long id, String name) {
    }

    /** Convenience overload for the admin-action controllers, which describe the effect of a
     *  just-performed admin operation on some organization, not "my own access" - internalMode/
     *  organization name are not meaningful there. */
    public static AccessContextDto from(AccessContext context) {
        return from(context, false, null);
    }

    public static AccessContextDto from(AccessContext context, boolean internalMode, Company organization) {
        PlanDto plan = context.plan() != null ? new PlanDto(context.plan().code(), context.plan().name()) : null;
        OrganizationDto organizationDto = organization != null
                ? new OrganizationDto(organization.getId(), organization.getName())
                : (context.organizationId() != null ? new OrganizationDto(context.organizationId(), null) : null);
        return new AccessContextDto(
                context.canOpenModule(),
                context.readOnly(),
                internalMode,
                context.subscriptionStatus() != null ? context.subscriptionStatus().name() : null,
                context.organizationId(),
                context.role(),
                context.membershipStatus(),
                organizationDto,
                plan,
                context.startsAt(),
                context.expiresAt(),
                context.daysRemaining(),
                context.features(),
                context.permissions().stream().map(Enum::name).sorted().toList(),
                context.limits(),
                context.usage(),
                context.availableActions(),
                context.reason(),
                context.testOverride()
        );
    }
}
