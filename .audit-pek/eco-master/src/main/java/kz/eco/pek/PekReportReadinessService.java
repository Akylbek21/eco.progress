package kz.eco.pek;

import kz.eco.pek.dto.PekApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class PekReportReadinessService {
    private final PekReportPlanFactRowRepository rows;
    private final PekReportProtocolSourceRepository sources;
    private final PekReportExceedanceRepository exceedances;
    private final PekSettingsService settingsService;
    private final PekEnvironmentalPermitRepository permitRepository;

    public PekReportReadinessService(PekReportPlanFactRowRepository rows,
                                     PekReportProtocolSourceRepository sources,
                                     PekReportExceedanceRepository exceedances, PekSettingsService settingsService,
                                     PekEnvironmentalPermitRepository permitRepository) {
        this.rows = rows;
        this.sources = sources;
        this.exceedances = exceedances;
        this.settingsService = settingsService;
        this.permitRepository = permitRepository;
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ReadinessResponse evaluate(PekReport report) {
        var plan = rows.findByReportIdOrderByControlItemIdAsc(report.getId());
        int planned = plan.stream().mapToInt(PekReportPlanFactRow::getPlannedCount).sum();
        int completed = plan.stream().mapToInt(r -> Math.min(r.getActualCount(), r.getPlannedCount())).sum();
        int missing = plan.stream().mapToInt(PekReportPlanFactRow::getMissingCount).sum();
        long unmatched = sources.countByReportIdAndMatchStatusAndExcludedFalse(report.getId(), PekMatchStatus.UNMATCHED);
        long ambiguous = sources.countByReportIdAndMatchStatusAndExcludedFalse(report.getId(), PekMatchStatus.AMBIGUOUS);
        long stale = sources.countByReportIdAndMatchStatus(report.getId(), PekMatchStatus.STALE);
        long openExceedances = exceedances.countOpenByReportId(report.getId());
        PekSettings settings = settingsService.getEffectiveSettings(report.getCompanyId());
        List<PekApiDtos.ReadinessIssue> issues = new ArrayList<>();
        issue(issues, settings.isRequireAllPlanFactItems() && missing > 0, "MISSING_MEASUREMENTS", "PLAN_FACT", "Не выполнено " + missing + " плановых измерений");
        issue(issues, settings.isBlockSubmitWithUnmatchedResults() && unmatched > 0, "UNMATCHED_SOURCES", "SOURCES", "Есть несопоставленные результаты: " + unmatched);
        issue(issues, settings.isBlockSubmitWithAmbiguousResults() && ambiguous > 0, "AMBIGUOUS_SOURCES", "SOURCES", "Есть неоднозначные результаты: " + ambiguous);
        issue(issues, settings.isBlockSubmitWithStaleSources() && stale > 0, "STALE_SOURCES", "SOURCES", "Есть устаревшие связи: " + stale);
        issue(issues, settings.isBlockSubmitWithOpenExceedances() && openExceedances > 0, "OPEN_EXCEEDANCES", "EXCEEDANCES", "Не обработаны превышения: " + openExceedances);
        issue(issues, report.getResponsibleUserId() == null, "RESPONSIBLE_REQUIRED", "GENERAL", "Не назначен ответственный за отчёт");
        issue(issues, plan.isEmpty(), "NO_PLAN_FACT", "PLAN_FACT", "Расчёт plan/fact отсутствует");
        // Iteration 2: a program that has at least one permit record but none currently ACTIVE (or
        // whose date range covers today) is flagged as a non-blocking warning - deliberately not
        // blocking, since not every program requires a permit and PekProgram has no explicit
        // "requires permit" flag to check against.
        boolean hasAnyPermit = !permitRepository.findByPekProgramId(report.getProgramId()).isEmpty();
        boolean hasActivePermit = permitRepository.findByPekProgramId(report.getProgramId()).stream()
                .anyMatch(p -> p.isActiveOn(java.time.LocalDate.now()));
        nonBlockingIssue(issues, hasAnyPermit && !hasActivePermit, "MISSING_ACTIVE_PERMIT", "PERMITS",
                "Нет действующего разрешения, привязанного к программе ПЭК");
        int progress = planned == 0 ? 0 : BigDecimal.valueOf(completed * 100L)
                .divide(BigDecimal.valueOf(planned), 0, RoundingMode.HALF_UP).intValue();
        // ready() must only depend on blocking issues - a non-blocking warning (e.g.
        // MISSING_ACTIVE_PERMIT above) must never flip readiness to false.
        boolean ready = issues.stream().noneMatch(PekApiDtos.ReadinessIssue::blocking);
        return new PekApiDtos.ReadinessResponse(ready, progress,
                new PekApiDtos.ReadinessSummary(planned, completed, missing, unmatched, ambiguous, stale,
                        openExceedances, 0), issues);
    }

    private static void issue(List<PekApiDtos.ReadinessIssue> target, boolean condition,
                              String code, String section, String message) {
        if (condition) target.add(new PekApiDtos.ReadinessIssue(code, section, "ERROR", message, true));
    }

    private static void nonBlockingIssue(List<PekApiDtos.ReadinessIssue> target, boolean condition,
                                          String code, String section, String message) {
        if (condition) target.add(new PekApiDtos.ReadinessIssue(code, section, "WARNING", message, false));
    }
}
