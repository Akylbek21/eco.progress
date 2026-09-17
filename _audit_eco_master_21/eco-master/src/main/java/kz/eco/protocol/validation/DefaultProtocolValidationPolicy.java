package kz.eco.protocol.validation;

import java.util.List;

/**
 * Fallback policy returned by {@link ProtocolValidationPolicyRegistry#resolve(String)} for any
 * template key with no registered policy. Applies only the shared baseline measurement checks
 * (indicatorName, value, unit) and no header checks, so wiring the registry in does not break
 * template types that have not been given a dedicated policy yet.
 */
final class DefaultProtocolValidationPolicy extends AbstractProtocolValidationPolicy {

    static final DefaultProtocolValidationPolicy INSTANCE = new DefaultProtocolValidationPolicy();

    private DefaultProtocolValidationPolicy() {
    }

    @Override
    public String templateKey() {
        return "default";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        return List.of();
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        return validateBaseline(index, measurement);
    }
}
