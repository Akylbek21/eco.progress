package kz.eco.protocol.validation;

/**
 * Immutable validation error produced by a {@link ProtocolValidationPolicy}.
 * <p>
 * {@code field} uses a dotted/indexed convention so multiple errors compose cleanly into a
 * {@code fieldErrors} map (or a list of API field errors) by the caller, e.g.:
 * <ul>
 *     <li>{@code header.objectId} - a header-level field</li>
 *     <li>{@code measurements.1.unit} - the {@code unit} field of the measurement at index 1 (0-based)</li>
 * </ul>
 */
public record ProtocolValidationError(String field, String code, String message) {
}
