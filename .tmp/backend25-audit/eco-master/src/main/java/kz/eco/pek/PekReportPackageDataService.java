package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.docgen.PekEnvironmentalMeasuresDocumentGenerationService;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The per-period figures the package documents need and no protocol provides: actual execution of
 * the program's environmental measures, and the balance columns of the emissions table.
 *
 * <p>Writes follow every other report mutation: If-Match on the REPORT version, editable status,
 * company-scoped edit permission, then a contentRevision bump so documents rendered from the old
 * figures become stale. Each row additionally carries its own optimistic-lock version.
 */
@Service
public class PekReportPackageDataService {

    private final PekReportRepository reports;
    private final PekAccessService access;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekReportMeasureExecutionRepository executions;
    private final PekReportEmissionBalanceRepository balances;
    private final PekEmissionSourceRepository sources;
    private final PekEnvironmentalMeasuresDocumentGenerationService measures;
    private final PekMonitoringExcelGenerationService emissions;

    public PekReportPackageDataService(PekReportRepository reports, PekAccessService access,
                                       PekReportContentRevisionService contentRevisionService,
                                       PekReportMeasureExecutionRepository executions,
                                       PekReportEmissionBalanceRepository balances,
                                       PekEmissionSourceRepository sources,
                                       PekEnvironmentalMeasuresDocumentGenerationService measures,
                                       PekMonitoringExcelGenerationService emissions) {
        this.reports = reports;
        this.access = access;
        this.contentRevisionService = contentRevisionService;
        this.executions = executions;
        this.balances = balances;
        this.sources = sources;
        this.measures = measures;
        this.emissions = emissions;
    }

    // ---- measure executions -------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<PekApiDtos.MeasureExecutionDto> measureExecutions(Long reportId) {
        PekReport report = report(reportId);
        Map<Long, PekReportMeasureExecution> byMeasure = executions.findByReportId(reportId).stream()
                .collect(Collectors.toMap(PekReportMeasureExecution::getMeasureId, Function.identity(), (a, b) -> a));
        return measures.measuresFor(report).stream().map(m -> {
            PekReportMeasureExecution e = byMeasure.get(m.getId());
            BigDecimal actual = e == null ? null : e.getActualAmount();
            BigDecimal utilization = actual == null || m.getPlannedBudget() == null || m.getPlannedBudget().signum() == 0
                    ? null : actual.multiply(BigDecimal.valueOf(100)).divide(m.getPlannedBudget(), 1, RoundingMode.HALF_UP);
            return new PekApiDtos.MeasureExecutionDto(m.getId(), m.getCode(), m.getName(), m.getWorkVolume(),
                    m.getPlannedStartDate() == null ? null : m.getPlannedStartDate().toString(),
                    m.getPlannedEndDate() == null ? null : m.getPlannedEndDate().toString(),
                    m.getPlannedBudget(), m.getCurrency(), actual, utilization,
                    e == null ? null : e.getCompletionPercent(), m.getEnvironmentalEffect(),
                    (e == null ? m.getStatus() : e.getStatus()).name(),
                    e == null ? null : e.getNote(), e == null ? null : e.getNonCompletionReason(),
                    e == null ? null : e.getVersion());
        }).toList();
    }

    @Transactional
    public List<PekApiDtos.MeasureExecutionDto> saveMeasureExecutions(Long reportId, Long expectedVersion,
                                                                      List<PekApiDtos.MeasureExecutionRequest> rows) {
        PekReport report = lockForEdit(reportId, expectedVersion);
        Set<Long> allowed = measures.measuresFor(report).stream().map(PekProgramMeasure::getId).collect(Collectors.toSet());
        Map<Long, PekReportMeasureExecution> byMeasure = executions.findByReportId(reportId).stream()
                .collect(Collectors.toMap(PekReportMeasureExecution::getMeasureId, Function.identity(), (a, b) -> a));
        Long userId = CurrentUser.get().getId();
        Set<Long> seen = new HashSet<>();
        for (PekApiDtos.MeasureExecutionRequest r : rows == null ? List.<PekApiDtos.MeasureExecutionRequest>of() : rows) {
            if (r.measureId() == null || !allowed.contains(r.measureId())) {
                throw new BadRequestException("Мероприятие не относится к программе и периоду отчёта: " + r.measureId(),
                        "PEK_FOREIGN_CHILD_ID");
            }
            if (!seen.add(r.measureId())) {
                throw new BadRequestException("Мероприятие указано дважды: " + r.measureId());
            }
            percentInRange(r.completionPercent(), "completionPercent");
            nonNegative(r.actualAmount(), "actualAmount");
            PekReportMeasureExecution e = byMeasure.get(r.measureId());
            if (e == null) {
                e = new PekReportMeasureExecution();
                e.setReportId(reportId);
                e.setMeasureId(r.measureId());
            }
            e.setActualAmount(r.actualAmount());
            e.setCompletionPercent(r.completionPercent());
            if (r.status() != null && !r.status().isBlank()) {
                try {
                    e.setStatus(PekMeasureStatus.valueOf(r.status().trim().toUpperCase()));
                } catch (IllegalArgumentException ex) {
                    throw new BadRequestException("Неизвестный статус мероприятия: " + r.status());
                }
            }
            e.setNote(trim(r.note()));
            e.setNonCompletionReason(trim(r.nonCompletionReason()));
            e.setUpdatedBy(userId);
            e.setUpdatedAt(LocalDateTime.now());
            executions.save(e);
        }
        executions.flush();
        contentRevisionService.bump(report);
        return measureExecutions(reportId);
    }

    // ---- emission balances --------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<PekApiDtos.EmissionBalanceDto> emissionBalances(Long reportId) {
        PekReport report = report(reportId);
        Map<String, PekReportEmissionBalance> stored = balances.findByReportId(reportId).stream()
                .collect(Collectors.toMap(b -> key(b.getEmissionSourceId(), b.getSubstanceCode()), Function.identity(), (a, b) -> a));
        List<PekApiDtos.EmissionBalanceDto> out = new ArrayList<>();
        for (PekMonitoringExcelGenerationService.EmissionLine l : emissions.lines(report)) {
            PekReportEmissionBalance b = stored.get(key(l.emissionSourceId(), l.substanceCode()));
            out.add(new PekApiDtos.EmissionBalanceDto(l.emissionSourceId(), l.sourceCode(), l.sourceName(),
                    l.substanceCode(), l.substanceName(),
                    b == null ? null : b.getWithoutTreatmentTons(), b == null ? null : b.getCapturedTons(),
                    b == null ? null : b.getUtilizedTons(), b == null ? null : b.getIncreaseReason(),
                    l.increased(), b == null ? null : b.getVersion()));
        }
        return out;
    }

    @Transactional
    public List<PekApiDtos.EmissionBalanceDto> saveEmissionBalances(Long reportId, Long expectedVersion,
                                                                    List<PekApiDtos.EmissionBalanceRequest> rows) {
        PekReport report = lockForEdit(reportId, expectedVersion);
        Set<Long> programSources = sources.findByProgramIdOrderBySortOrderAscIdAsc(report.getProgramId()).stream()
                .map(PekEmissionSource::getId).collect(Collectors.toSet());
        Map<String, PekReportEmissionBalance> stored = balances.findByReportId(reportId).stream()
                .collect(Collectors.toMap(b -> key(b.getEmissionSourceId(), b.getSubstanceCode()), Function.identity(), (a, b) -> a));
        Long userId = CurrentUser.get().getId();
        for (PekApiDtos.EmissionBalanceRequest r : rows == null ? List.<PekApiDtos.EmissionBalanceRequest>of() : rows) {
            if (r.emissionSourceId() == null || !programSources.contains(r.emissionSourceId())) {
                throw new BadRequestException("Источник выбросов не относится к программе отчёта: " + r.emissionSourceId(),
                        "PEK_FOREIGN_CHILD_ID");
            }
            if (r.substanceCode() == null || r.substanceCode().isBlank()) {
                throw new BadRequestException("Укажите код вещества (substanceCode)");
            }
            nonNegative(r.withoutTreatmentTons(), "withoutTreatmentTons");
            nonNegative(r.capturedTons(), "capturedTons");
            nonNegative(r.utilizedTons(), "utilizedTons");
            if (r.capturedTons() != null && r.utilizedTons() != null && r.utilizedTons().compareTo(r.capturedTons()) > 0) {
                throw new BadRequestException("Утилизировано не может быть больше, чем уловлено", "PEK_EMISSION_BALANCE_INVALID");
            }
            String k = key(r.emissionSourceId(), r.substanceCode());
            PekReportEmissionBalance b = stored.get(k);
            if (b == null) {
                b = new PekReportEmissionBalance();
                b.setReportId(reportId);
                b.setEmissionSourceId(r.emissionSourceId());
                b.setSubstanceCode(r.substanceCode().trim());
                stored.put(k, b);
            }
            b.setWithoutTreatmentTons(r.withoutTreatmentTons());
            b.setCapturedTons(r.capturedTons());
            b.setUtilizedTons(r.utilizedTons());
            b.setIncreaseReason(trim(r.increaseReason()));
            b.setUpdatedBy(userId);
            b.setUpdatedAt(LocalDateTime.now());
            balances.save(b);
        }
        balances.flush();
        contentRevisionService.bump(report);
        return emissionBalances(reportId);
    }

    // ---- helpers ------------------------------------------------------------------------------

    private PekReport lockForEdit(Long reportId, Long expectedVersion) {
        if (expectedVersion == null) {
            throw new BadRequestException("Требуется заголовок If-Match с текущей версией отчёта ПЭК", "VERSION_REQUIRED");
        }
        PekReport report = reports.findByIdForUpdate(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        if (!Objects.equals(expectedVersion, report.getVersion())) {
            throw ConflictException.versionConflict("Отчёт ПЭК был изменён другим пользователем",
                    "OPTIMISTIC_LOCK_CONFLICT", report.getVersion());
        }
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Отчёт в статусе " + report.getStatus() + " нельзя редактировать",
                    "PEK_REPORT_NOT_EDITABLE");
        }
        User actor = CurrentUser.get();
        access.requireCompanyEditPermission(actor.getId(), actor.getRole(), report.getCompanyId());
        return report;
    }

    private PekReport report(Long id) {
        return reports.findById(id).orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    private static String key(Long sourceId, String code) {
        return sourceId + "|" + (code == null ? "" : code.trim().toUpperCase());
    }

    private static void percentInRange(BigDecimal v, String field) {
        if (v != null && (v.signum() < 0 || v.compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw new BadRequestException(field + " должен быть от 0 до 100");
        }
    }

    private static void nonNegative(BigDecimal v, String field) {
        if (v != null && v.signum() < 0) {
            throw new BadRequestException(field + " не может быть отрицательным");
        }
    }

    private static String trim(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
