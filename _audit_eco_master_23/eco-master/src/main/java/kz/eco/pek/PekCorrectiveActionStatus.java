package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/** Lifecycle of a single corrective action under a {@link PekReportExceedance} - independent of
 *  the parent exceedance's own status (an exceedance can stay OPEN while some of its corrective
 *  actions are already DONE and others still PLANNED). */
public enum PekCorrectiveActionStatus {
    PLANNED,
    IN_PROGRESS,
    DONE,
    CANCELLED;

    private static final Map<PekCorrectiveActionStatus, Set<PekCorrectiveActionStatus>> ALLOWED_TRANSITIONS = Map.of(
            PLANNED, Set.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, Set.of(DONE, CANCELLED),
            DONE, Set.of(),
            CANCELLED, Set.of()
    );

    public boolean canTransitionTo(PekCorrectiveActionStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isOpen() {
        return this == PLANNED || this == IN_PROGRESS;
    }
}
