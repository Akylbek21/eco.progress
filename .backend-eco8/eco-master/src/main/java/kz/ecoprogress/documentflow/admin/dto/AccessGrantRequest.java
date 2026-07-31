package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.Map;

public record AccessGrantRequest(
        @NotNull Long organizationId,
        @NotBlank String planCode,
        @NotNull LocalDateTime startsAt,
        LocalDateTime expiresAt,
        LocalDateTime graceEndsAt,
        @NotNull PaymentMode paymentMode,
        String paymentReference,
        String reason,
        Map<UsageMetric, Long> limits
) {
}
