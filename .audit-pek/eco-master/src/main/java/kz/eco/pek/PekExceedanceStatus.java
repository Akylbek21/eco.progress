package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/** Lifecycle of one {@link PekReportExceedance} - module spec §14. Every exceedance is created
 *  OPEN by {@link PekPlanFactService}'s recompute; a human resolves it explicitly (never
 *  auto-resolved by a later recompute finding the same measurement still over the limit - only a
 *  measurement that stops existing, or stops exceeding, makes its row disappear on recompute).
 *
 * <p>Iteration 2 of the PEK module overhaul adds the full corrective-action workflow states
 *  (IN_PROGRESS/VERIFIED/CLOSED/CANCELLED) on top of the original OPEN/UNDER_REVIEW/CONFIRMED/
 *  FALSE_POSITIVE/RESOLVED set, with an explicit {@link #ALLOWED_TRANSITIONS} map mirroring
 *  {@code kz.eco.protocol.ProtocolStatus}'s pattern - a transition not listed here is rejected by
 *  {@code PekExceedanceService#requireTransition}, never silently allowed. */
public enum PekExceedanceStatus {
    OPEN,
    UNDER_REVIEW,
    CONFIRMED,
    FALSE_POSITIVE,
    IN_PROGRESS,
    RESOLVED,
    VERIFIED,
    CLOSED,
    CANCELLED;

    private static final Map<PekExceedanceStatus, Set<PekExceedanceStatus>> ALLOWED_TRANSITIONS = Map.ofEntries(
            Map.entry(OPEN, Set.of(UNDER_REVIEW, IN_PROGRESS, CONFIRMED, FALSE_POSITIVE, CANCELLED)),
            Map.entry(UNDER_REVIEW, Set.of(CONFIRMED, FALSE_POSITIVE, IN_PROGRESS, CANCELLED)),
            Map.entry(CONFIRMED, Set.of(IN_PROGRESS, RESOLVED, CANCELLED)),
            Map.entry(IN_PROGRESS, Set.of(RESOLVED, CANCELLED)),
            Map.entry(RESOLVED, Set.of(VERIFIED, CLOSED, IN_PROGRESS)),
            Map.entry(VERIFIED, Set.of(CLOSED)),
            Map.entry(FALSE_POSITIVE, Set.of(CLOSED)),
            Map.entry(CLOSED, Set.of()),
            Map.entry(CANCELLED, Set.of())
    );

    /** Statuses that still count as "open" for readiness/dashboard purposes - everything except a
     *  terminal outcome. Kept in sync with {@code PekReportExceedanceRepository#countOpenByReportId}'s
     *  hand-written JPQL NOT IN list; see that query's javadoc. */
    public boolean isOpen() {
        return this != RESOLVED && this != FALSE_POSITIVE && this != CLOSED && this != CANCELLED;
    }

    public boolean canTransitionTo(PekExceedanceStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
