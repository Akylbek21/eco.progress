package kz.eco.protocol.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Contract for the "create a lab protocol out of the ПЭК programme" flow (blocker 1):
 * <ul>
 *   <li>GET /api/protocols/creation-context - what the ПЭК programme requires for a given
 *       company/object on a given date, and which of those requirements are still outstanding;</li>
 *   <li>POST /api/protocols/from-pek - turn exactly one of those requirements into a real DRAFT
 *       protocol plus its canonical {@link kz.eco.pek.PekReportProtocolSource} link.</li>
 * </ul>
 * Every id in a requirement is a real database id resolved server-side from the approved/active
 * programme - the client only echoes them back in the create request, and the server re-validates
 * every one of them (see PEK_CONTEXT_MISMATCH).
 */
public final class ProtocolPekCreationDtos {

    private ProtocolPekCreationDtos() {
    }

    /** Status of one ПЭК requirement in the requested period. */
    public enum RequirementStatus {
        /** Planned for this period, not yet fulfilled, period still open. */
        DUE,
        /** Planned for this period, not yet fulfilled, the period's end has already passed. */
        OVERDUE,
        /** The planned number of measurements for the period already exists. */
        COMPLETED,
        /** Nothing is planned for this period (frequency does not fall into it). */
        NOT_DUE,
        /** A mandatory setting is missing (no protocol template for the monitoring direction, no
         *  indicators configured, ...) - a protocol cannot be created until it is fixed. */
        CONFIGURATION_REQUIRED
    }

    public record NamedRef(Long id, String name) {}

    public record ProgramRef(Long id, String number, String name) {}

    /** Reporting period the requirements were evaluated against (the quarter containing {@code date}). */
    public record PeriodInfo(String label, int year, int quarter, String startDate, String endDate) {}

    public record IndicatorInfo(Long id, String name, String unit, String normativeLabel) {}

    public record Requirement(
            /** Stable identifier of the requirement - identical to the DB-level uniqueness key
             *  used to prevent duplicate drafts (see PekReportProtocolSource.requirementKey). */
            String id,
            String status,
            String title,
            String subtitle,
            String frequency,
            int planCount,
            int completedCount,
            int missingCount,
            boolean canCreate,
            Long companyId,
            Long objectId,
            Long pekProgramId,
            Long pekMonitoringId,
            Long pekControlItemId,
            Long monitoringPointId,
            String monitoringPointName,
            String protocolTemplateId,
            String protocolTemplateName,
            String laboratoryName,
            Long existingDraftProtocolId,
            List<IndicatorInfo> indicators
    ) {}

    public record CreationContextResponse(
            boolean hasActiveProgram,
            NamedRef company,
            NamedRef object,
            ProgramRef program,
            PeriodInfo period,
            List<Requirement> requirements
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateProtocolFromPekRequest(
            Long companyId,
            Long objectId,
            Long pekProgramId,
            Long pekMonitoringId,
            Long pekControlItemId,
            Long monitoringPointId,
            String protocolTemplateId,
            /** Optional: pin the draft to one specific programme indicator. When omitted the link
             *  stays at control-item granularity (the control item's whole indicator set). */
            Long programIndicatorId,
            /** Optional: the date the requirement period is derived from. Defaults to today. */
            String date
    ) {}
}
