package kz.eco.pek;

/** Lifecycle of one {@link PekRegulationVersionRow} (item 1 of the PEK settings module fix).
 *  Exactly one row is ACTIVE at a time - see {@link PekRegulationAdminService#activate}. */
public enum PekRegulationVersionStatus {
    ACTIVE,
    ARCHIVED
}
