package kz.eco.pek;

/** How often a {@link PekProgramControlItem} must be executed - paired with frequencyValue
 *  (e.g. QUARTERLY + frequencyValue=1 means once per quarter, MONTHLY + frequencyValue=2 means
 *  twice a month) so plan/fact (module spec §11) can compute plannedCount for any report period. */
public enum PekFrequencyType {
    DAILY,
    WEEKLY,
    MONTHLY,
    QUARTERLY,
    SEMIANNUAL,
    ANNUAL,
    PER_EVENT
}
