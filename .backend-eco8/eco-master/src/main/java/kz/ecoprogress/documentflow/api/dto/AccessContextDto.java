package kz.ecoprogress.documentflow.api.dto;

import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Exact response shape for GET /api/document-flow/access (ticket point 9). */
public record AccessContextDto(
        boolean available,
        boolean readOnly,
        String status,
        PlanDto plan,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        Long daysRemaining,
        Set<FeatureCode> features,
        List<String> permissions,
        Map<UsageMetric, Long> limits,
        Map<UsageMetric, Long> usage,
        List<String> availableActions,
        String reason
) {
    public record PlanDto(String code, String name) {
    }

    public static AccessContextDto from(AccessContext context) {
        PlanDto plan = context.plan() != null ? new PlanDto(context.plan().code(), context.plan().name()) : null;
        return new AccessContextDto(
                context.canOpenModule(),
                context.readOnly(),
                context.subscriptionStatus() != null ? context.subscriptionStatus().name() : null,
                plan,
                context.startsAt(),
                context.expiresAt(),
                context.daysRemaining(),
                context.features(),
                context.permissions().stream().map(Enum::name).sorted().toList(),
                context.limits(),
                context.usage(),
                context.availableActions(),
                context.reason()
        );
    }
}
