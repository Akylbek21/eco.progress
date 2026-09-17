package kz.eco.protocol.validation;

import java.util.Collections;
import java.util.Map;

/**
 * Plain-data carrier of the header-level fields a {@link ProtocolValidationPolicy} may need to
 * validate a quick-create / ready-for-approval request. Built by the caller from whatever request
 * DTO is in play at the time (this package does not bind to that DTO directly).
 * <p>
 * {@code conditions} holds the type-specific condition fields coming from the wizard's per-type
 * "conditions" object (e.g. {@code waterType}, {@code waterUseCategory}, {@code season},
 * {@code workCategory}, {@code roomType}, {@code workplaceType}, {@code noiseType},
 * {@code lightingType}, {@code sampleNumber}, {@code samplingDepth}, {@code samplingPlace},
 * {@code factorType}, ...). Values are looked up by string key and treated as opaque {@code Object}s
 * since their concrete type may vary by caller.
 */
public record ProtocolValidationContext(
        Long companyId,
        Long objectId,
        Long laboratoryId,
        Long executorId,
        String protocolDate,
        String sampleDate,
        String testingStartDate,
        String testingEndDate,
        String measurementPlace,
        Map<String, Object> conditions
) {

    public ProtocolValidationContext {
        conditions = conditions == null ? Collections.emptyMap() : conditions;
    }

    /**
     * Looks up a condition value by key and returns it as a trimmed string, or {@code null} when
     * absent, non-string, or blank. Convenience for the common "non-blank string condition" checks.
     */
    public String conditionAsString(String key) {
        Object value = conditions.get(key);
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    public boolean isConditionBlank(String key) {
        return conditionAsString(key) == null;
    }
}
