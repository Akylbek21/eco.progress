package kz.eco.protocol;

import java.util.Map;

/** Thrown by {@link ProtocolMutationGuard} when an action is attempted against a protocol whose
 *  current status forbids it (module spec §5) - maps to HTTP 409 with code PROTOCOL_IMMUTABLE and
 *  a structured details map ({@code protocolId}, {@code status}, {@code action}), never a bare
 *  message, so the frontend can render a precise reason instead of a generic failure. */
public class ProtocolImmutableException extends RuntimeException {

    private final Map<String, String> details;

    public ProtocolImmutableException(String message, Map<String, String> details) {
        super(message);
        this.details = details;
    }

    public Map<String, String> getDetails() {
        return details;
    }
}
