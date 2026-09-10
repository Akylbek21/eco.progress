package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/** Lifecycle of a {@link PekEnvironmentalPermit} - module spec §2 Iteration 2. An EXPIRED or
 *  REVOKED permit can never be treated as "the active permit" for a linked {@link PekProgram},
 *  regardless of its dates - see {@link PekPermitService#requireActive}. */
public enum PekPermitStatus {
    ACTIVE,
    EXPIRED,
    REVOKED;

    private static final Map<PekPermitStatus, Set<PekPermitStatus>> ALLOWED_TRANSITIONS = Map.of(
            ACTIVE, Set.of(EXPIRED, REVOKED),
            EXPIRED, Set.of(),
            REVOKED, Set.of()
    );

    public boolean canTransitionTo(PekPermitStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
