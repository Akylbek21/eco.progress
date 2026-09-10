package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/** Lifecycle of one {@link PekProgramMeasure} (природоохранное мероприятие). Independent from
 *  PekProgramStatus - a program can be ACTIVE while its individual measures are still PLANNED,
 *  IN_PROGRESS, overdue, etc. OVERDUE is not set by a transition call; it's derived from
 *  plannedEndDate having passed while still PLANNED/IN_PROGRESS (see PekProgramService#toMeasureDto). */
public enum PekMeasureStatus {
    PLANNED,
    IN_PROGRESS,
    COMPLETED,
    OVERDUE,
    CANCELLED;

    private static final Map<PekMeasureStatus, Set<PekMeasureStatus>> ALLOWED_TRANSITIONS = Map.of(
            PLANNED, Set.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, Set.of(COMPLETED, CANCELLED),
            COMPLETED, Set.of(),
            CANCELLED, Set.of()
    );

    public boolean canTransitionTo(PekMeasureStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
