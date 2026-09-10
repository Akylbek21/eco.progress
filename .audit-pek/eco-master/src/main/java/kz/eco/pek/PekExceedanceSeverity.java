package kz.eco.pek;

/** How far a measurement exceeded its normative (module spec §14), computed purely from the ratio
 *  actual/normative for LE-style comparisons (or the mirrored ratio for GE) - see
 *  {@link PekPlanFactService#classifySeverity}. */
public enum PekExceedanceSeverity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
