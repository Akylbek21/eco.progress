package kz.eco.protocol.validation;

import java.util.List;

/**
 * Per-protocol-type required-field validation policy for quick-create / ready-for-approval.
 * <p>
 * Implementations are Spring beans; {@link #templateKey()} must return one of the 8 canonical
 * backend template type keys exactly as normalized by {@code ProtocolTemplateCode}:
 * {@code ambient_air, workplace_air, soil, water, microclimate, lighting, noise_vibration,
 * uv_emf_laser}. Resolution/normalization (including the {@code water_wastewater} -> {@code water}
 * frontend alias) is handled by {@link ProtocolValidationPolicyRegistry}, not by policies themselves.
 */
public interface ProtocolValidationPolicy {

    /**
     * The canonical template key this policy applies to.
     */
    String templateKey();

    /**
     * Validates header-level (protocol-wide) fields for this protocol type.
     */
    List<ProtocolValidationError> validateHeader(ProtocolValidationContext context);

    /**
     * Validates a single measurement row for this protocol type.
     *
     * @param index       0-based index of the measurement within the request, used to build field paths
     * @param context     header-level context, in case a measurement rule depends on it
     * @param measurement the measurement row to validate
     */
    List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement);
}
