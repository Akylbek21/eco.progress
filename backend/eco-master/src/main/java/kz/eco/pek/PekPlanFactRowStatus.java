package kz.eco.pek;

/** Execution status of one {@link PekReportPlanFactRow} - module spec §6, computed by
 *  {@link PekPlanFactService}, never set directly by a client except via the row's manualStatus
 *  override for a documented exception (module spec: "нельзя разрешать изменение без причины"). */
public enum PekPlanFactRowStatus {
    NOT_STARTED,
    PARTIALLY_COMPLETED,
    COMPLETED,
    OVERDUE,
    EXCEEDED,
    NOT_APPLICABLE
}
