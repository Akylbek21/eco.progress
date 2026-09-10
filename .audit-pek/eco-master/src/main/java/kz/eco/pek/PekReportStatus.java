package kz.eco.pek;

import java.util.Map;
import java.util.Set;

/**
 * Full PEK final-report lifecycle: assemble data (DRAFT/COLLECTING), send for internal review
 * (READY_FOR_REVIEW), return for revision or approve (RETURNED/APPROVED), sign (SIGNED), retire
 * (ARCHIVED).
 */
public enum PekReportStatus {
    DRAFT,
    COLLECTING,
    READY_FOR_REVIEW,
    RETURNED,
    APPROVED,
    /** Iteration 3: a signed final report (real CMS signature verified against the generated PDF,
     *  see PekReportSigningService). Sits between APPROVED and ARCHIVED. */
    SIGNED,
    /** Submitted to the regulatory authority for official acceptance (SIGNED → SUBMITTED).
     *  submittedAt is stamped on this transition; submissionDueDate was calculated at creation
     *  from the reporting period - independent of periodEnd and program.validUntil. */
    SUBMITTED,
    /** Regulatory authority accepted the submission (SUBMITTED → ACCEPTED). acceptedAt stamped. */
    ACCEPTED,
    /** Regulatory authority rejected the submission (SUBMITTED → REJECTED). rejectedAt and
     *  rejectionReason stamped. A rejected report may be corrected and re-submitted. */
    REJECTED,
    ARCHIVED;

    private static final Map<PekReportStatus, Set<PekReportStatus>> ALLOWED_TRANSITIONS = Map.of(
            DRAFT, Set.of(COLLECTING),
            COLLECTING, Set.of(COLLECTING, READY_FOR_REVIEW),
            READY_FOR_REVIEW, Set.of(RETURNED, APPROVED),
            RETURNED, Set.of(COLLECTING, READY_FOR_REVIEW),
            APPROVED, Set.of(SIGNED, ARCHIVED),
            SIGNED, Set.of(SUBMITTED, ARCHIVED),
            SUBMITTED, Set.of(ACCEPTED, REJECTED),
            ACCEPTED, Set.of(ARCHIVED),
            REJECTED, Set.of(SUBMITTED, ARCHIVED),
            ARCHIVED, Set.of()
    );

    public boolean canTransitionTo(PekReportStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isEditable() {
        return this == DRAFT || this == COLLECTING || this == RETURNED;
    }
}
