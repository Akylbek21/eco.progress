package kz.eco.pek;

/**
 * How a {@link PekReportProtocolSource} row ended up linked to its report - the real reconciliation
 * outcome {@link PekReportCollectionService#collect} now records for EVERY actual ProtocolResult it
 * sees, never by skipping a row:
 * <ul>
 *   <li>{@link #MATCHED} - the normal automatic (or confirmed-manual) outcome: exactly one program
 *       indicator candidate by normalized name+unit, {@code programIndicatorId}/{@code
 *       controlItemId} are set.</li>
 *   <li>{@link #UNMATCHED} - zero candidate indicators matched this result by name+unit. The row
 *       still exists (protocol/result linkage is real), it just isn't attributable to a plan
 *       position yet; {@code programIndicatorId}/{@code controlItemId} stay null.</li>
 *   <li>{@link #AMBIGUOUS} - more than one candidate indicator matched; collect() deliberately does
 *       not guess which one is right (module spec: "не привязывать без анализа результатов").
 *       {@code programIndicatorId}/{@code controlItemId} stay null.</li>
 *   <li>{@link #MANUAL} - a human explicitly resolved an UNMATCHED/AMBIGUOUS row (or added a link
 *       collect() didn't produce) via the manual-override path; a MANUAL row's own {@code
 *       matchType} field is {@code "MANUAL"} while matchStatus here reflects whether that manual
 *       choice is itself confirmed (MATCHED) - kept as its own status value for rows recorded before
 *       manual confirmation flows existed.</li>
 *   <li>{@link #EXCLUDED} - a human explicitly excluded this link from plan/fact (distinct from the
 *       {@code excluded} boolean column, which is the actual filter predicate reads use; this status
 *       value is kept for display/audit purposes).</li>
 * </ul>
 */
public enum PekMatchStatus {
    MATCHED,
    UNMATCHED,
    AMBIGUOUS,
    MANUAL,
    MANUALLY_MATCHED,
    EXCLUDED,
    STALE
}
