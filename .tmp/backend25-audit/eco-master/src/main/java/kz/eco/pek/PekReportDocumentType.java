package kz.eco.pek;

/**
 * Discriminates the distinct PEK report document products:
 * - OFFICIAL: the государственная (state-facing) report, rendered from the versioned normative
 *   template mandated by Правила №250 - format is fixed by regulation and must carry a
 *   templateVersion reference so recipients can verify which edition of the template was used.
 * - INTERNAL: the internal CRM analytical report for operational management - layout is
 *   CRM-driven (plan/fact deltas, exceedance analytics, trend sections) and is NOT subject to
 *   the normative template constraint, though it still snapshots regulationVersion for traceability.
 * - EXPLANATORY_NOTE: пояснительная записка к отчёту ПЭК за период (DOCX + PDF).
 * - ENVIRONMENTAL_MEASURES: отчёт о выполнении природоохранных мероприятий за период (DOCX + PDF).
 * - EMISSIONS_XLSX: официальная таблица выбросов в атмосферу по источникам (XLSX only).
 *
 * <p>All types share one gapless version sequence per report (see
 * PekReportDocumentGenerationService#lockReport), so documents of different types stay orderable.
 */
public enum PekReportDocumentType {
    OFFICIAL,
    INTERNAL,
    EXPLANATORY_NOTE,
    ENVIRONMENTAL_MEASURES,
    EMISSIONS_XLSX;

    /** Rendered as DOCX with a PDF made from the same bytes; false only for spreadsheet products. */
    public boolean hasWordAndPdf() {
        return this != EMISSIONS_XLSX;
    }
}
