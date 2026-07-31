package kz.eco.pek;

/**
 * How a {@link PekReportProtocolSource} row ended up linked to its report: MATCHED is the normal
 * automatic outcome of {@link PekReportCollectionService#collect}; MANUAL and EXCLUDED are reserved
 * for a future manual-override endpoint (not built in this slice - see the module-level report for
 * what's out of scope) that would let a human add a protocol collect() didn't pick up, or exclude
 * one it did.
 */
public enum PekMatchStatus {
    MATCHED,
    MANUAL,
    EXCLUDED
}
