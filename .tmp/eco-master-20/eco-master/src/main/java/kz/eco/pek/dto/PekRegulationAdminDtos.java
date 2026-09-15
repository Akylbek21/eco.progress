package kz.eco.pek.dto;

import java.util.List;

/**
 * DTOs for the global (not tenant-scoped) "Нормативная база" / "Сроки сдачи" admin configuration -
 * items 1/3/8/9 of the PEK settings module fix. Kept out of {@link PekApiDtos} deliberately: every
 * other DTO there is either tenant-scoped or program/report-scoped, and this configuration is
 * neither - mixing it in would blur that boundary for every future reader of that file.
 */
public final class PekRegulationAdminDtos {

    private PekRegulationAdminDtos() {
    }

    public record RegulationVersionResponse(
            Long id,
            String code,
            String title,
            String baseOrder,
            String revisionOrder,
            String effectiveFrom,
            String effectiveTo,
            String programTemplateVersion,
            String reportTemplateVersion,
            String status,
            Long version,
            String createdByName,
            String createdAt,
            String updatedByName,
            String updatedAt,
            /** Item 11: a version already stamped on at least one program/report can never be
             *  deleted - the frontend uses this to grey the delete action out instead of letting
             *  the user hit a 409. */
            boolean inUse
    ) {
    }

    /** Item 1/11: code/templateVersion must never be blank; effectiveFrom is mandatory so
     *  {@link kz.eco.pek.PekRegulationVersion#isEffectiveOn} is always well-defined. */
    public record CreateRegulationVersionRequest(
            String code,
            String title,
            String baseOrder,
            String revisionOrder,
            String effectiveFrom,
            String programTemplateVersion,
            String reportTemplateVersion
    ) {
    }

    public record DeadlineRuleResponse(
            Long id,
            String reportType,
            String regulationCode,
            int monthsAfterPeriodEnd,
            String description,
            boolean active,
            Long version,
            String createdByName,
            String createdAt,
            String updatedByName,
            String updatedAt
    ) {
    }

    public record CreateDeadlineRuleRequest(
            String reportType,
            String regulationCode,
            Integer monthsAfterPeriodEnd,
            String description
    ) {
    }

    public record UpdateDeadlineRuleRequest(
            Integer monthsAfterPeriodEnd,
            String description,
            Boolean active
    ) {
    }

    public record RegulationAdminOverview(
            List<RegulationVersionResponse> regulationVersions,
            List<DeadlineRuleResponse> deadlineRules
    ) {
    }

    // ============================================================================================
    // Item 4: official table configuration (mandatory/applicable/order/periodicity/requiredFields).
    // ============================================================================================

    public record OfficialTableConfigResponse(
            Long id,
            String regulationCode,
            String tableType,
            boolean mandatory,
            boolean applicable,
            int displayOrder,
            String periodicity,
            List<String> requiredFields,
            Long version,
            String updatedByName,
            String updatedAt
    ) {
    }

    public record UpdateOfficialTableConfigRequest(
            Boolean mandatory,
            Boolean applicable,
            Integer displayOrder,
            String periodicity,
            List<String> requiredFields
    ) {
    }

    // ============================================================================================
    // Item 5: reference catalogs, read only, single source (no per-module duplicates).
    // ============================================================================================

    public record ReferenceCatalogEntry(String code, String label) {
    }

    public record ReferenceCatalogsResponse(
            List<ReferenceCatalogEntry> monitoringTypes,
            List<ReferenceCatalogEntry> controlTypes,
            List<ReferenceCatalogEntry> officialTableTypes,
            List<ReferenceCatalogEntry> reportTypes
    ) {
    }

    // ============================================================================================
    // Item 6: defaults the frontend must use instead of letting the user pick
    // regulationCode/regulationVersion/templateVersion manually.
    // ============================================================================================

    public record RegulationDefaultsResponse(
            String regulationCode,
            String regulationTitle,
            String programTemplateVersion,
            String reportTemplateVersion,
            String defaultReportType,
            List<OfficialTableConfigResponse> officialTables
    ) {
    }
}
