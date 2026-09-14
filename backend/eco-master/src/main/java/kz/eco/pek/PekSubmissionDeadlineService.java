package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.company.SpecialMonitoringType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Resolves the statutory submission deadline from a rule table keyed on
 * ({@link PekReportType}, regulation edition code) - never on {@link PekPeriodType} alone.
 *
 * <p><b>What changed and why.</b> The previous implementation applied
 * {@code periodEnd.plusDays(45)} to every annual report. That is not a rule the regulation states,
 * and a fixed day offset also drifts with month length, landing on 14.02 or 15.02 depending on the
 * year. Under the edition in force since 19.04.2026, п.23 sets calendar deadlines:
 *
 * <ul>
 *   <li>quarterly ПЭК report - the 1st day of the second month following the reporting quarter
 *       (Q1 → 01.05, Q2 → 01.08, Q3 → 01.11, Q4 → 01.02 of the following year);</li>
 *   <li>annual tables 7 and 12 of the ПЭК form - the 1st day of the third month following the
 *       reporting period (2026 → 01.03.2027);</li>
 *   <li>annual ПЭМ for the Kazakhstani sector of the Caspian Sea - likewise the 1st day of the
 *       third month following the reporting period (2026 → 01.03.2027).</li>
 * </ul>
 *
 * <p>The two annual rules resolve to the same date but stay separate rows: they are distinct
 * obligations for distinct facilities, and folding them together would make a future divergence
 * invisible.
 *
 * <p>{@code submissionDueDate} computed here is the authoritative source of truth for the
 * scheduler, dashboard, notifications and readiness - never {@code report.periodEnd}.
 *
 * <p><b>Adding an edition:</b> add its {@link PekRegulationVersion} entry, then add one rule row
 * per report type for that edition's code. A report already stamped with an older edition keeps
 * resolving against that edition's rows, so an amendment never retroactively moves the deadline of
 * a report filed under the previous one.
 */
@Service
public class PekSubmissionDeadlineService {

    /**
     * Rule table. {@code monthsAfterPeriodEnd} is added to the period's last day and the result is
     * snapped to the 1st of that month.
     *
     * <p>The base 2021 edition carries the same rows as the 2026 one. This system has no record of
     * what п.23 said before the amendment, and inventing a different historical rule would be worse
     * than carrying the known one forward; deadlines already computed and stored are never
     * recalculated, so this affects only reports created from now on under the older stamp.
     */
    private static final List<PekSubmissionDeadlineRule> RULES = List.of(
            new PekSubmissionDeadlineRule(PekReportType.PEK_QUARTERLY,
                    PekRegulationVersionService.PEK_RULES_250_2026_59, 2,
                    "до 1 числа второго месяца, следующего за отчётным кварталом"),
            new PekSubmissionDeadlineRule(PekReportType.PEK_TABLES_7_12_ANNUAL,
                    PekRegulationVersionService.PEK_RULES_250_2026_59, 3,
                    "до 1 числа третьего месяца, следующего за отчётным периодом"
                            + " (таблицы 7 и 12 формы ПЭК, ежегодно)"),
            new PekSubmissionDeadlineRule(PekReportType.PEM_CASPIAN_ANNUAL,
                    PekRegulationVersionService.PEK_RULES_250_2026_59, 3,
                    "до 1 числа третьего месяца, следующего за отчётным периодом"
                            + " (ПЭМ, казахстанская часть Каспийского моря, ежегодно)"),

            new PekSubmissionDeadlineRule(PekReportType.PEK_QUARTERLY,
                    PekRegulationVersionService.PEK_RULES_250_2021, 2,
                    "до 1 числа второго месяца, следующего за отчётным кварталом"),
            new PekSubmissionDeadlineRule(PekReportType.PEK_TABLES_7_12_ANNUAL,
                    PekRegulationVersionService.PEK_RULES_250_2021, 3,
                    "до 1 числа третьего месяца, следующего за отчётным периодом"
                            + " (таблицы 7 и 12 формы ПЭК, ежегодно)"),
            new PekSubmissionDeadlineRule(PekReportType.PEM_CASPIAN_ANNUAL,
                    PekRegulationVersionService.PEK_RULES_250_2021, 3,
                    "до 1 числа третьего месяца, следующего за отчётным периодом"
                            + " (ПЭМ, казахстанская часть Каспийского моря, ежегодно)")
    );

    public List<PekSubmissionDeadlineRule> rules() {
        return RULES;
    }

    public Optional<PekSubmissionDeadlineRule> findRule(PekReportType reportType, String regulationCode) {
        return RULES.stream()
                .filter(r -> r.reportType() == reportType && r.regulationCode().equals(regulationCode))
                .findFirst();
    }

    /**
     * @param reportType     statutory classification of the report
     * @param regulationCode edition the report is stamped with ({@link PekRegulationVersion#code()})
     * @param periodEnd      last day of the reporting period, computed server-side from
     *                       periodType+year+quarter, never taken from user input
     */
    public LocalDate calculate(PekReportType reportType, String regulationCode, LocalDate periodEnd) {
        if (periodEnd == null) {
            return null;
        }
        PekSubmissionDeadlineRule rule = findRule(reportType, regulationCode)
                .orElseThrow(() -> new BadRequestException(
                        "Не задано правило срока представления для типа отчёта " + reportType
                                + " и версии нормативной базы " + regulationCode));
        return rule.deadlineFor(periodEnd);
    }

    /**
     * Rejects a report type the facility's monitoring regime does not allow, then returns the
     * deadline.
     *
     * <p>The check lives here, not only at the call site, because PEM_CASPIAN_ANNUAL carries a
     * materially later deadline: reaching it for a facility that is not marked CASPIAN_MARINE would
     * hand an operator a filing date a month later than the one that actually binds them.
     */
    public LocalDate calculateFor(PekReportType reportType, SpecialMonitoringType facilityRegime,
                                  String regulationCode, LocalDate periodEnd) {
        SpecialMonitoringType regime = facilityRegime == null ? SpecialMonitoringType.NONE : facilityRegime;
        if (!reportType.isAvailableFor(regime)) {
            throw new ConflictException(
                    "Тип отчёта " + reportType + " доступен только для объекта с признаком "
                            + SpecialMonitoringType.CASPIAN_MARINE
                            + " (ПЭМ в казахстанской части Каспийского моря)",
                    "PEK_REPORT_TYPE_NOT_AVAILABLE_FOR_FACILITY");
        }
        return calculate(reportType, regulationCode, periodEnd);
    }
}
