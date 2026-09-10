package kz.eco.pek.dto;

import java.util.Map;

public final class PekSettingsDtos {
    private PekSettingsDtos() {}
    public record UserShort(Long id, String fullName) {}
    public record LaboratoryShort(Long id, String name) {}
    public record UpdateRequest(Long defaultResponsibleUserId, Long defaultLaboratoryId, String defaultReportType,
            Boolean autoCollectProtocols, Boolean includeOnlySignedProtocols, Boolean allowFallbackMatching,
            Boolean requireManualAmbiguousConfirmation, Boolean requireAllPlanFactItems,
            Boolean blockSubmitWithUnmatchedResults, Boolean blockSubmitWithAmbiguousResults,
            Boolean blockSubmitWithStaleSources, Boolean blockSubmitWithOpenExceedances,
            Integer notifyBeforeDeadlineDays, Boolean notifyMissingProtocols, Boolean notifyExceedances,
            Boolean notifyReportReturned) {}
    public record Response(Long companyId, Long defaultResponsibleUserId, Long defaultLaboratoryId,
            UserShort defaultResponsibleUser, LaboratoryShort defaultLaboratory,
            String defaultReportType, boolean autoCollectProtocols, boolean includeOnlySignedProtocols,
            boolean allowFallbackMatching, boolean requireManualAmbiguousConfirmation,
            boolean requireAllPlanFactItems, boolean blockSubmitWithUnmatchedResults,
            boolean blockSubmitWithAmbiguousResults, boolean blockSubmitWithStaleSources,
            boolean blockSubmitWithOpenExceedances, int notifyBeforeDeadlineDays,
            boolean notifyMissingProtocols, boolean notifyExceedances, boolean notifyReportReturned,
            Long version, Map<String,Boolean> availableActions, Map<String,Boolean> capabilities) {}
}
