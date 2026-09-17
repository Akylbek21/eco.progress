package kz.eco.pek;

/**
 * Discriminates the two distinct PEK report document products:
 * - OFFICIAL: the государственная (state-facing) report, rendered from the versioned normative
 *   template mandated by Правила №250 - format is fixed by regulation and must carry a
 *   templateVersion reference so recipients can verify which edition of the template was used.
 * - INTERNAL: the internal CRM analytical report for operational management - layout is
 *   CRM-driven (plan/fact deltas, exceedance analytics, trend sections) and is NOT subject to
 *   the normative template constraint, though it still snapshots regulationVersion for traceability.
 */
public enum PekReportDocumentType {
    OFFICIAL,
    INTERNAL
}
