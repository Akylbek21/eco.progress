package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotEmpty;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.Map;

public record LimitsRequest(
        @NotEmpty Map<UsageMetric, Long> limits,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        String reason
) {
}
