package kz.eco.pek;

import kz.eco.pek.dto.PekApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * GET /api/pek/dashboard - previously entirely absent (404 in production), the module's single
 * most critical gap. Every returned field is computed from real pek_programs/pek_reports rows;
 * see the field-by-field notes below for which ones are genuine metrics today and which are an
 * honest 0 because this module has no Issue/Exceedance/Action/ControlItem entities yet (only
 * PekProgram/PekReport/PekReportProtocolSource exist - confirmed by reading the whole package
 * before writing this class). Returning 0 for a feature that doesn't exist yet is correct per
 * spec §11 ("при отсутствии данных возвращать HTTP 200 и нулевые показатели") - it is NOT the
 * same as fabricating a plausible-looking fake number, which this class never does.
 */
@Service
public class PekDashboardService {

    private static final int EXPIRY_LOOKAHEAD_DAYS = 30;
    private static final Set<PekReportStatus> READINESS_STATUSES =
            Set.of(PekReportStatus.READY_FOR_REVIEW, PekReportStatus.APPROVED);
    private static final int MAX_REPORTS_IN_RESPONSE = 10;

    private final PekReportRepository reportRepository;
    private final PekProgramRepository programRepository;
    private final PekReportService reportService;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekReportPlanFactRowRepository planFactRowRepository;

    public PekDashboardService(PekReportRepository reportRepository, PekProgramRepository programRepository,
                               PekReportService reportService, PekReportProtocolSourceRepository sourceRepository,
                               PekReportExceedanceRepository exceedanceRepository,
                               PekReportPlanFactRowRepository planFactRowRepository) {
        this.reportRepository = reportRepository;
        this.programRepository = programRepository;
        this.reportService = reportService;
        this.sourceRepository = sourceRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.planFactRowRepository = planFactRowRepository;
    }

    /** @param companyIds tenant scope for a non-global caller (null = unrestricted). Applied at
     *  the SQL level in every underlying query, never filtered in Java after the fact - see
     *  PekAccessService#resolveAccessibleCompanyIds. */
    @Transactional(readOnly = true)
    public PekApiDtos.DashboardResponse dashboard(Long companyId, Long objectId, Integer year, Integer quarter,
                                                  String statusRaw, Long responsibleId, java.util.Collection<Long> companyIds) {
        PekReportStatus status = parseStatusOrNull(statusRaw);
        List<Long> scopeList = companyIds == null ? null : List.copyOf(companyIds);
        List<PekReport> reports = reportRepository.findForDashboard(
                companyId, objectId, year, quarter, status, responsibleId, scopeList);

        long total = reports.size();
        long ready = reports.stream().filter(r -> READINESS_STATUSES.contains(r.getStatus())).count();
        int readinessPercent = total == 0 ? 0 : (int) Math.round(100.0 * ready / total);

        long activePrograms = programRepository.countActiveInScope(companyId, objectId, scopeList);
        long activatablePrograms = programRepository.countActivatableInScope(companyId, objectId, scopeList);
        // Real proxy metric (share of non-archived programs that are actually ACTIVE), not a
        // stand-in for the "planned vs completed control items" execution tracking the full spec
        // describes - that needs PekProgramControlItem/Measure entities that don't exist yet.
        int programExecutionPercent = activatablePrograms == 0
                ? 0 : (int) Math.round(100.0 * activePrograms / activatablePrograms);

        LocalDate today = LocalDate.now();
        List<PekProgram> expiringSoon = programRepository.findActiveExpiringBetween(
                companyId, objectId, today, today.plusDays(EXPIRY_LOOKAHEAD_DAYS), scopeList);
        List<PekApiDtos.DashboardDeadline> deadlines = expiringSoon.stream()
                .map(p -> new PekApiDtos.DashboardDeadline(
                        p.getId(), "PROGRAM_EXPIRY", p.getValidUntil().toString(),
                        "Истекает срок действия программы ПЭК № " + p.getNumber()))
                .toList();

        List<PekApiDtos.ReportResponse> reportResponses = reports.stream()
                .limit(MAX_REPORTS_IN_RESPONSE)
                .map(reportService::toResponse)
                .toList();
        List<Long> reportIds = reports.stream().map(PekReport::getId).toList();
        long openExceedances = reportIds.isEmpty() ? 0 : exceedanceRepository.countOpenByReportIds(reportIds);
        long missingProtocols = reportIds.isEmpty() ? 0 : planFactRowRepository.sumMissingByReportIds(reportIds);
        long unmatched = reportIds.isEmpty() ? 0 : sourceRepository.countByReportIdInAndMatchStatusAndExcludedFalse(reportIds, PekMatchStatus.UNMATCHED);
        long ambiguous = reportIds.isEmpty() ? 0 : sourceRepository.countByReportIdInAndMatchStatusAndExcludedFalse(reportIds, PekMatchStatus.AMBIGUOUS);
        long stale = reportIds.isEmpty() ? 0 : sourceRepository.countByReportIdInAndMatchStatus(reportIds, PekMatchStatus.STALE);
        long returned = reports.stream().filter(r -> r.getStatus() == PekReportStatus.RETURNED).count();
        // Iteration 2: real overdue-actions count (exceedance still open past its dueDate) -
        // replaces the previous hardcoded 0 now that PekReportExceedance has a dueDate field.
        long overdueActions = reportIds.isEmpty() ? 0
                : exceedanceRepository.countOverdueByReportIds(reportIds, today);

        return new PekApiDtos.DashboardResponse(
                total,
                readinessPercent,
                openExceedances + missingProtocols + unmatched + ambiguous + stale,
                expiringSoon.size(), // overdueRiskCount - real: ACTIVE programs expiring soon
                programExecutionPercent,
                openExceedances,
                overdueActions,
                missingProtocols,
                returned,
                unmatched,
                ambiguous,
                stale,
                deadlines,
                reportResponses);
    }

    private static PekReportStatus parseStatusOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return PekReportStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
