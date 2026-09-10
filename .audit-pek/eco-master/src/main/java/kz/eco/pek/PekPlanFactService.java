package kz.eco.pek;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Computes real plan/fact and exceedances for a PEK report (module spec §6/§11/§14) - the
 * calculation {@link PekFrequencyType}'s own javadoc says was missing. Reads matched, non-excluded
 * per-result rows from {@code pek_report_protocol_sources} (populated by
 * {@link PekReportCollectionService#collect}, which now also does per-indicator result matching),
 * never re-derives them here - this service is purely the arithmetic layer on top of collection.
 *
 * <p>Recomputation is id-preserving reconciliation, the same lesson as PekProgramService's
 * control-item fix (module spec §4): a {@link PekReportPlanFactRow} keeps its identity across
 * recomputes (upsert keyed by programIndicatorId), and a {@link PekReportExceedance} keeps its
 * identity too (upsert keyed by protocolResultId) so a human's review state on an exceedance
 * survives the next collect() as long as the same measurement is still over the limit.
 */
@Service
public class PekPlanFactService {

    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final PekReportPlanFactRowRepository planFactRowRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final ProtocolResultRepository protocolResultRepository;

    public PekPlanFactService(PekProgramIndicatorRepository indicatorRepository,
                               PekProgramControlItemRepository controlItemRepository,
                               PekReportProtocolSourceRepository sourceRepository,
                               PekReportPlanFactRowRepository planFactRowRepository,
                               PekReportExceedanceRepository exceedanceRepository,
                               ProtocolResultRepository protocolResultRepository) {
        this.indicatorRepository = indicatorRepository;
        this.controlItemRepository = controlItemRepository;
        this.sourceRepository = sourceRepository;
        this.planFactRowRepository = planFactRowRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.protocolResultRepository = protocolResultRepository;
    }

    @Transactional
    public List<PekReportPlanFactRow> recompute(PekReport report) {
        List<PekProgramIndicator> indicators = indicatorRepository.findByProgramIdOrderBySortOrderAsc(report.getProgramId());
        Map<Long, PekProgramControlItem> controlItemsById = new HashMap<>();
        controlItemRepository.findAllById(indicators.stream().map(PekProgramIndicator::getControlItemId).distinct().toList())
                .forEach(item -> controlItemsById.put(item.getId(), item));

        Map<Long, PekReportPlanFactRow> existingRows = new HashMap<>();
        planFactRowRepository.findByReportIdOrderByControlItemIdAsc(report.getId())
                .forEach(row -> existingRows.put(row.getProgramIndicatorId(), row));

        Set<Long> keepIndicatorIds = new HashSet<>();
        List<PekReportPlanFactRow> result = new ArrayList<>();

        for (PekProgramIndicator indicator : indicators) {
            PekProgramControlItem controlItem = controlItemsById.get(indicator.getControlItemId());
            if (controlItem == null) {
                continue;
            }
            keepIndicatorIds.add(indicator.getId());

            int planned = PekFrequencyCalculator.plannedOccurrences(
                    controlItem.getFrequencyType(), controlItem.getFrequencyValue(),
                    controlItem.getPlannedCount(), report.getPeriodStart(), report.getPeriodEnd());

            List<PekReportProtocolSource> matched =
                    sourceRepository.findByReportIdAndProgramIndicatorIdAndExcludedFalse(report.getId(), indicator.getId());

            List<MeasurementValue> measurements = new ArrayList<>();
            for (PekReportProtocolSource source : matched) {
                ProtocolResult protocolResult = protocolResultRepository.findById(source.getProtocolResultId()).orElse(null);
                // A result row with no numeric value yet (e.g. still awaiting lab entry) still
                // counts as "a measurement happened" for actualCount, but contributes nothing to
                // best/worst/average or exceedance detection - module spec: "значение 0 не должно
                // теряться", handled naturally here since 0 is a valid BigDecimal, not null.
                if (protocolResult != null) {
                    measurements.add(new MeasurementValue(source, protocolResult));
                }
            }

            PekReportPlanFactRow row = existingRows.get(indicator.getId());
            if (row == null) {
                row = new PekReportPlanFactRow();
                row.setReportId(report.getId());
                row.setProgramIndicatorId(indicator.getId());
            }
            row.setControlItemId(controlItem.getId());
            row.setNormativeValue(indicator.getNormativeValue());
            row.setComparisonType(indicator.getComparisonType());
            row.setPlannedCount(planned);
            row.setActualCount(measurements.size());
            row.setMissingCount(Math.max(0, planned - measurements.size()));
            row.setCompletionPercent(completionPercent(planned, measurements.size()));
            applyValueStatistics(row, indicator, measurements);
            row.setUpdatedAt(LocalDateTime.now());
            if (row.getStatus() == null) {
                // status is NOT NULL - this first save() exists only to get a real generated id
                // (IDENTITY strategy) for a brand-new row before reconcileExceedances() below can
                // set exceedance.planFactRowId, so the real, exceedance-aware status computed after
                // reconcileExceedances() isn't known yet at this point. A placeholder here is
                // immediately overwritten by the second save() a few lines down - pre-existing gap
                // (a fresh PekReportPlanFactRow otherwise has no default status at all and this
                // insert fails NOT NULL) fixed as part of wiring collect() to reliably call
                // recompute() for programs whose indicators never had a plan/fact row before.
                row.setStatus(PekPlanFactRowStatus.NOT_STARTED);
            }
            planFactRowRepository.save(row);

            List<PekReportExceedance> exceedances = reconcileExceedances(report, row, indicator, measurements);
            row.setHasExceedance(!exceedances.isEmpty());
            row.setExceedanceCount(exceedances.size());
            row.setStatus(deriveStatus(controlItem, planned, measurements.size(), !exceedances.isEmpty()));
            planFactRowRepository.save(row);
            result.add(row);
        }

        // An indicator no longer part of the program (legitimately removed - PekProgramService
        // already blocks removal while report-linked measurements exist, module spec §4) leaves
        // its plan/fact row and any exceedances orphaned; clean them up rather than showing stale
        // rows for indicators that don't exist anymore.
        for (PekReportPlanFactRow existing : existingRows.values()) {
            if (!keepIndicatorIds.contains(existing.getProgramIndicatorId())) {
                exceedanceRepository.deleteAll(exceedanceRepository.findByPlanFactRowId(existing.getId()));
                planFactRowRepository.delete(existing);
            }
        }
        return result;
    }

    private record MeasurementValue(PekReportProtocolSource source, ProtocolResult protocolResult) {
        BigDecimal value() { return protocolResult.getResultValue(); }
    }

    private static BigDecimal completionPercent(int planned, int actual) {
        if (planned <= 0) {
            return actual > 0 ? BigDecimal.valueOf(100) : BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(Math.min(actual, planned) * 100L)
                .divide(BigDecimal.valueOf(planned), 2, RoundingMode.HALF_UP);
    }

    private static void applyValueStatistics(PekReportPlanFactRow row, PekProgramIndicator indicator,
                                              List<MeasurementValue> measurements) {
        List<BigDecimal> values = measurements.stream().map(MeasurementValue::value).filter(v -> v != null).toList();
        if (values.isEmpty()) {
            row.setBestValue(null);
            row.setWorstValue(null);
            row.setAverageValue(null);
            return;
        }
        BigDecimal min = values.stream().reduce(BigDecimal::min).orElseThrow();
        BigDecimal max = values.stream().reduce(BigDecimal::max).orElseThrow();
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = sum.divide(BigDecimal.valueOf(values.size()), 6, RoundingMode.HALF_UP);
        row.setAverageValue(average);
        // "Best" depends on which direction is safe: for an upper-bound normative (LE/LESS_OR_EQUAL)
        // lower is better; for a lower-bound one (GE/GREATER_OR_EQUAL) higher is better. Anything
        // else (RANGE/EQUAL/ABSENT/INFO) has no single "better" direction, so min/max are reported
        // as-is without a best/worst judgement.
        if (indicator.getComparisonType() == ComparisonType.GREATER_OR_EQUAL) {
            row.setBestValue(max);
            row.setWorstValue(min);
        } else {
            row.setBestValue(min);
            row.setWorstValue(max);
        }
    }

    private static PekPlanFactRowStatus deriveStatus(PekProgramControlItem controlItem, int planned, int actual, boolean hasExceedance) {
        if (hasExceedance) {
            return PekPlanFactRowStatus.EXCEEDED;
        }
        if (planned == 0) {
            return controlItem.isMandatory() ? PekPlanFactRowStatus.NOT_STARTED : PekPlanFactRowStatus.NOT_APPLICABLE;
        }
        if (actual == 0) {
            return PekPlanFactRowStatus.NOT_STARTED;
        }
        return actual >= planned ? PekPlanFactRowStatus.COMPLETED : PekPlanFactRowStatus.PARTIALLY_COMPLETED;
    }

    private List<PekReportExceedance> reconcileExceedances(PekReport report, PekReportPlanFactRow row,
                                                             PekProgramIndicator indicator, List<MeasurementValue> measurements) {
        List<PekReportExceedance> current = new ArrayList<>();
        for (MeasurementValue measurement : measurements) {
            BigDecimal value = measurement.value();
            Optional<BigDecimal> ratio = value != null
                    ? exceedanceRatio(value, indicator.getNormativeValue(), indicator.getMinValue(), indicator.getMaxValue(), indicator.getComparisonType())
                    : Optional.empty();

            Optional<PekReportExceedance> existing = exceedanceRepository.findByReportIdAndProtocolResultId(
                    report.getId(), measurement.source().getProtocolResultId());

            if (ratio.isEmpty()) {
                // No longer (or never) exceeding - a previously-flagged exceedance for this exact
                // measurement is removed rather than left stale (see class javadoc).
                existing.ifPresent(exceedanceRepository::delete);
                continue;
            }
            PekReportExceedance exceedance = existing.orElseGet(PekReportExceedance::new);
            exceedance.setReportId(report.getId());
            exceedance.setPlanFactRowId(row.getId());
            exceedance.setProtocolId(measurement.source().getProtocolId());
            exceedance.setProtocolResultId(measurement.source().getProtocolResultId());
            exceedance.setProgramIndicatorId(indicator.getId());
            exceedance.setActualValue(value);
            exceedance.setNormativeValue(indicator.getNormativeValue() != null ? indicator.getNormativeValue() : value);
            exceedance.setComparisonType(indicator.getComparisonType());
            exceedance.setExceedanceRatio(ratio.get());
            exceedance.setSeverity(classifySeverity(ratio.get()));
            exceedance.setUpdatedAt(LocalDateTime.now());
            exceedanceRepository.save(exceedance);
            current.add(exceedance);
        }
        return current;
    }

    /** @return the "how many times over the limit" ratio (always &gt;= a value indicating a real
     *  violation), or empty if the comparison type has no violation for this value. Package-visible
     *  for unit testing without a Spring context. */
    static Optional<BigDecimal> exceedanceRatio(BigDecimal value, BigDecimal normativeValue,
                                                 BigDecimal minValue, BigDecimal maxValue, ComparisonType comparisonType) {
        if (comparisonType == null) {
            return Optional.empty();
        }
        return switch (comparisonType) {
            case LESS_OR_EQUAL -> {
                if (normativeValue == null || normativeValue.signum() == 0 || value.compareTo(normativeValue) <= 0) {
                    yield Optional.empty();
                }
                yield Optional.of(value.divide(normativeValue, 4, RoundingMode.HALF_UP));
            }
            case GREATER_OR_EQUAL -> {
                if (normativeValue == null || value.compareTo(normativeValue) >= 0) {
                    yield Optional.empty();
                }
                if (value.signum() == 0) {
                    yield Optional.of(BigDecimal.valueOf(9999));
                }
                yield Optional.of(normativeValue.divide(value, 4, RoundingMode.HALF_UP));
            }
            case RANGE, BETWEEN -> {
                BigDecimal lower = minValue;
                BigDecimal upper = maxValue;
                if (lower != null && value.compareTo(lower) < 0 && lower.signum() != 0) {
                    yield Optional.of(lower.divide(value.signum() == 0 ? BigDecimal.ONE : value, 4, RoundingMode.HALF_UP).abs());
                }
                if (upper != null && value.compareTo(upper) > 0 && upper.signum() != 0) {
                    yield Optional.of(value.divide(upper, 4, RoundingMode.HALF_UP));
                }
                yield Optional.empty();
            }
            case EQUAL -> value.compareTo(normativeValue) == 0 ? Optional.empty() : Optional.of(BigDecimal.valueOf(2));
            // ABSENT: normative requires zero/non-detection - any positive value is a violation.
            case ABSENT -> value.signum() > 0 ? Optional.of(BigDecimal.valueOf(2)) : Optional.empty();
            case INFO -> Optional.empty();
        };
    }

    static PekExceedanceSeverity classifySeverity(BigDecimal ratio) {
        if (ratio.compareTo(BigDecimal.valueOf(1.5)) <= 0) {
            return PekExceedanceSeverity.LOW;
        }
        if (ratio.compareTo(BigDecimal.valueOf(2)) <= 0) {
            return PekExceedanceSeverity.MEDIUM;
        }
        if (ratio.compareTo(BigDecimal.valueOf(5)) <= 0) {
            return PekExceedanceSeverity.HIGH;
        }
        return PekExceedanceSeverity.CRITICAL;
    }
}
