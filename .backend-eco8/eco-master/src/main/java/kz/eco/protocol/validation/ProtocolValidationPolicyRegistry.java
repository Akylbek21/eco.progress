package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Resolves the {@link ProtocolValidationPolicy} for a given template key.
 * <p>
 * All {@link ProtocolValidationPolicy} beans are autowired and indexed by {@link ProtocolValidationPolicy#templateKey()}.
 * {@code water_wastewater} (the frontend alias) is normalized to {@code water} on lookup so a
 * single {@code WaterValidationPolicy} bean serves both. Unknown/unregistered keys fall back to
 * {@link DefaultProtocolValidationPolicy} rather than throwing, so wiring this registry into the
 * request flow is non-breaking even if a type is missing a dedicated policy.
 */
@Component
public class ProtocolValidationPolicyRegistry {

    private final Map<String, ProtocolValidationPolicy> policiesByKey;

    public ProtocolValidationPolicyRegistry(List<ProtocolValidationPolicy> policies) {
        Map<String, ProtocolValidationPolicy> map = new HashMap<>();
        for (ProtocolValidationPolicy policy : policies) {
            map.put(normalize(policy.templateKey()), policy);
        }
        this.policiesByKey = map;
    }

    /**
     * Resolves the policy registered for {@code templateKey}, normalizing known aliases
     * ({@code water_wastewater} -> {@code water}). Falls back to a no-op default policy when no
     * policy is registered for the (normalized) key.
     */
    public ProtocolValidationPolicy resolve(String templateKey) {
        String normalized = normalize(templateKey);
        if (normalized == null) {
            return DefaultProtocolValidationPolicy.INSTANCE;
        }
        return policiesByKey.getOrDefault(normalized, DefaultProtocolValidationPolicy.INSTANCE);
    }

    private static String normalize(String templateKey) {
        if (templateKey == null || templateKey.isBlank()) {
            return null;
        }
        String key = templateKey.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        if ("water_wastewater".equals(key)) {
            return "water";
        }
        return key;
    }
}
