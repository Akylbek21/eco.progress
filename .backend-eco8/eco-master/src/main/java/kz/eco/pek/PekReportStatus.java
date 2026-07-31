package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/**
 * Simplified from the full 14-status DRAFT..ARCHIVED workflow in the module spec (review/approve/
 * sign/submit/accept/reject/revision are all real follow-on work, not built in this slice) - this
 * covers the actually-implemented lifecycle: assemble data, send for internal review, approve,
 * retire.
 */
public enum PekReportStatus {
    DRAFT,
    COLLECTING,
    READY_FOR_REVIEW,
    APPROVED,
    ARCHIVED;

    private static final Map<PekReportStatus, Set<PekReportStatus>> ALLOWED_TRANSITIONS = Map.of(
            DRAFT, Set.of(COLLECTING),
            COLLECTING, Set.of(COLLECTING, READY_FOR_REVIEW),
            READY_FOR_REVIEW, Set.of(COLLECTING, APPROVED),
            APPROVED, Set.of(ARCHIVED),
            ARCHIVED, Set.of()
    );

    public boolean canTransitionTo(PekReportStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isEditable() {
        return this == DRAFT || this == COLLECTING;
    }
}
