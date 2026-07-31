package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/**
 * Full review-cycle state machine (module spec §15) - DRAFT/ACTIVE/ARCHIVED-only (the first
 * vertical slice) grows here into the documented DRAFT -> UNDER_REVIEW -> RETURNED/APPROVED ->
 * ACTIVE -> ARCHIVED cycle, with RETURNED looping back to UNDER_REVIEW after correction.
 */
public enum PekProgramStatus {
    DRAFT,
    UNDER_REVIEW,
    RETURNED,
    APPROVED,
    ACTIVE,
    ARCHIVED;

    private static final Map<PekProgramStatus, Set<PekProgramStatus>> ALLOWED_TRANSITIONS = Map.of(
            DRAFT, Set.of(UNDER_REVIEW, ARCHIVED),
            UNDER_REVIEW, Set.of(RETURNED, APPROVED),
            RETURNED, Set.of(UNDER_REVIEW),
            APPROVED, Set.of(ACTIVE),
            ACTIVE, Set.of(ARCHIVED),
            ARCHIVED, Set.of()
    );

    /** DRAFT and RETURNED are the only statuses whose control items/indicators/measures/header can
     *  still be edited - everything from UNDER_REVIEW onward is a frozen submission awaiting a
     *  decision or already decided (module spec §16's "нельзя разрешать изменение без версии"
     *  extended to "нельзя редактировать вне DRAFT/RETURNED"). */
    public boolean isEditable() {
        return this == DRAFT || this == RETURNED;
    }

    public boolean canTransitionTo(PekProgramStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
