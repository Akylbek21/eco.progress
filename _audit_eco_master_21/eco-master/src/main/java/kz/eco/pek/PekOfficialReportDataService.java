package kz.eco.pek;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.SpecialMonitoringType;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Builds the official (state-facing) report structure - one row per matched {@code ProtocolResult}
 * classified into the applicable official table ({@link PekOfficialTableType}) - and is the single
 * place that logic lives. {@link PekReportCollectionService#collect} calls
 * {@link #rebuildResultRows} to (re)persist {@link PekReportResultRow}s after every reconciliation
 * pass; {@link PekController}'s {@code GET .../official-data} endpoint and
 * {@code OfficialPekReportDocxRenderer}'s builder both call {@link #getOfficialData} to read the
 * same persisted rows back - there is exactly one computation, read in three places.
 *
 * <p>Never re-derives protocol/indicator matching itself: it only classifies and formats rows that
 * {@link PekReportCollectionService} has already matched (module spec: "не вводить результаты
 * повторно вручную, если они уже существуют в ProtocolResult").
 */
@Service
public class PekOfficialReportDataService {

    /** g -&gt; t and seconds -&gt; hours factor for the standard emissions-inventory formula
     *  t/year = g/s * hours/year * 3600 / 1,000,000. */
    private static final BigDecimal GRAMS_PER_TON = BigDecimal.valueOf(1_000_000);
    private static final BigDecimal SECONDS_PER_HOUR = BigDecimal.valueOf(3600);

    private final PekReportResultRowRepository resultRowRepository;
    private final PekProgramRepository programRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekEmissionSourceRepository emissionSourceRepository;
    private final PekDischargeSourceRepository dischargeSourceRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;
    private final ProtocolRepository protocolRepository;
    private final ProtocolResultRepository protocolResultRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;

    public PekOfficialReportDataService(PekReportResultRowRepository resultRowRepository,
                                         PekProgramRepository programRepository,
                                         PekProgramControlItemRepository controlItemRepository,
                                         PekProgramIndicatorRepository indicatorRepository,
                                         PekProgramMonitoringRepository monitoringRepository,
                                         PekReportExceedanceRepository exceedanceRepository,
                                         PekEmissionSourceRepository emissionSourceRepository,
                                         PekDischargeSourceRepository dischargeSourceRepository,
                                         PekMonitoringPointRepository monitoringPointRepository,
                                         ProtocolRepository protocolRepository,
                                         ProtocolResultRepository protocolResultRepository,
                                         LaboratoryRepository laboratoryRepository,
                                         CompanyRepository companyRepository,
                                         CompanyObjectRepository companyObjectRepository) {
        this.resultRowRepository = resultRowRepository;
        this.programRepository = programRepository;
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.monitoringRepository = monitoringRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.emissionSourceRepository = emissionSourceRepository;
        this.dischargeSourceRepository = dischargeSourceRepository;
        this.monitoringPointRepository = monitoringPointRepository;
        this.protocolRepository = protocolRepository;
        this.protocolResultRepository = protocolResultRepository;
        this.laboratoryRepository = laboratoryRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
    }

    // ============================================================================================
    // Build (called by PekReportCollectionService#collect after reconciliation) ------------------
    // ============================================================================================

    /**
     * Rebuilds the full set of {@link PekReportResultRow}s for {@code report} from its currently
     * MATCHED, non-excluded, result-level protocol sources (delete-then-reinsert - see the entity
     * javadoc for why an id-preserving upsert buys nothing here). Also freezes the report's
     * laboratory snapshot the first time a matched protocol resolves to a real laboratory
     * ({@link PekReport#hasLaboratorySnapshot()} guards against ever overwriting it again).
     *
     * @param matchedSources this report's current MATCHED, non-excluded, result-level sources
     *                       (protocolResultId != null) - the caller (collect()) has already
     *                       computed exactly this set, so it is passed in rather than re-queried.
     */
    @Transactional
    public void rebuildResultRows(PekReport report, PekProgram program,
                                   List<PekReportProtocolSource> matchedSources) {
        resultRowRepository.deleteByReportId(report.getId());
        if (matchedSources.isEmpty()) {
            return;
        }
        CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);
        boolean marineObject = object != null && object.getSpecialMonitoringType() == SpecialMonitoringType.CASPIAN_MARINE;

        Set<Long> resultIds = matchedSources.stream().map(PekReportProtocolSource::getProtocolResultId)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, ProtocolResult> resultsById = protocolResultRepository.findAllById(resultIds).stream()
                .collect(java.util.stream.Collectors.toMap(ProtocolResult::getId, r -> r));
        Set<Long> protocolIds = matchedSources.stream().map(PekReportProtocolSource::getProtocolId)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, Protocol> protocolsById = protocolRepository.findAllById(protocolIds).stream()
                .collect(java.util.stream.Collectors.toMap(Protocol::getId, p -> p));
        Map<Long, PekProgramControlItem> controlItemsById = controlItemRepository
                .findByProgramIdOrderBySortOrderAsc(report.getProgramId()).stream()
                .collect(java.util.stream.Collectors.toMap(PekProgramControlItem::getId, c -> c));
        Map<Long, PekProgramIndicator> indicatorsById = indicatorRepository
                .findByProgramIdOrderBySortOrderAsc(report.getProgramId()).stream()
                .collect(java.util.stream.Collectors.toMap(PekProgramIndicator::getId, i -> i));
        Map<Long, PekReportExceedance> exceedanceByResultId = exceedanceRepository.findByReportId(report.getId()).stream()
                .filter(e -> e.getProtocolResultId() != null)
                .collect(java.util.stream.Collectors.toMap(PekReportExceedance::getProtocolResultId, e -> e, (a, b) -> a));

        List<PekReportResultRow> rows = new ArrayList<>();
        Long freezeLaboratoryId = null;
        for (PekReportProtocolSource source : matchedSources) {
            ProtocolResult result = resultsById.get(source.getProtocolResultId());
            Protocol protocol = protocolsById.get(source.getProtocolId());
            PekProgramControlItem controlItem = source.getControlItemId() == null ? null
                    : controlItemsById.get(source.getControlItemId());
            if (result == null || protocol == null || controlItem == null) {
                continue; // dangling/unmatched at control-item level - nothing to classify into a table
            }
            PekOfficialTableType tableType = classify(controlItem, result, marineObject);
            if (tableType == null) {
                continue; // WASTE/BIODIVERSITY etc - not one of the 9 official result tables
            }
            PekProgramIndicator indicator = source.getProgramIndicatorId() == null ? null
                    : indicatorsById.get(source.getProgramIndicatorId());
            PekReportExceedance exceedance = exceedanceByResultId.get(result.getId());

            rows.add(buildRow(report, tableType, controlItem, indicator, source, protocol, result, exceedance));
            if (freezeLaboratoryId == null && protocol.getLaboratoryId() != null) {
                freezeLaboratoryId = protocol.getLaboratoryId();
            }
        }
        resultRowRepository.saveAll(rows);

        if (!report.hasLaboratorySnapshot() && freezeLaboratoryId != null) {
            freezeLaboratorySnapshot(report, freezeLaboratoryId);
        }
    }

    /** Written once per report, ever - see {@link PekReport#hasLaboratorySnapshot()}. */
    private void freezeLaboratorySnapshot(PekReport report, Long laboratoryId) {
        Laboratory lab = laboratoryRepository.findById(laboratoryId).orElse(null);
        if (lab == null) {
            return;
        }
        report.setLaboratoryIdSnapshot(lab.getId());
        report.setLaboratoryNameSnapshot(lab.getName());
        report.setLaboratoryBinSnapshot(lab.getBin());
        report.setAccreditationNumberSnapshot(lab.getAccreditationNumber());
        report.setAccreditationValidFromSnapshot(lab.getAccreditationIssuedAt());
        report.setAccreditationValidUntilSnapshot(lab.getAccreditationValidUntil());
    }

    /**
     * Which official table a matched control item's result belongs to - null for a control item
     * whose {@link PekControlType} is not one of the 9 official tables (WASTE has its own dedicated
     * movement mechanism, BIODIVERSITY has no normative/actual table shape yet).
     */
    private static PekOfficialTableType classify(PekProgramControlItem controlItem, ProtocolResult result,
                                                   boolean marineObject) {
        PekControlType type = controlItem.getControlType();
        if (type == null) {
            return null;
        }
        return switch (type) {
            case EMISSION -> "CALCULATED".equalsIgnoreCase(result.getCalculationStatus())
                    ? PekOfficialTableType.CALCULATED_EMISSIONS : PekOfficialTableType.EMISSIONS;
            case AMBIENT_AIR -> PekOfficialTableType.AMBIENT_AIR;
            case WASTEWATER -> marineObject ? PekOfficialTableType.MARINE : PekOfficialTableType.WASTEWATER;
            case WATER_INTAKE -> marineObject ? PekOfficialTableType.MARINE : PekOfficialTableType.WATER;
            case SOIL -> PekOfficialTableType.SOIL;
            case PHYSICAL_FACTOR -> isRadiological(result) ? PekOfficialTableType.RADIATION
                    : PekOfficialTableType.INSTRUMENTAL_MEASUREMENTS;
            case WASTE, BIODIVERSITY -> null;
        };
    }

    private static final Set<String> RADIATION_KEYWORDS =
            Set.of("радиац", "доза", "гамма", "радон", "радионуклид");

    private static boolean isRadiological(ProtocolResult result) {
        String name = result.getIndicatorName();
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        return RADIATION_KEYWORDS.stream().anyMatch(lower::contains);
    }

    private PekReportResultRow buildRow(PekReport report, PekOfficialTableType tableType,
                                         PekProgramControlItem controlItem, PekProgramIndicator indicator,
                                         PekReportProtocolSource source, Protocol protocol, ProtocolResult result,
                                         PekReportExceedance exceedance) {
        PekReportResultRow row = new PekReportResultRow();
        row.setReportId(report.getId());
        row.setSectionType(tableType);
        row.setControlItemId(controlItem.getId());
        row.setMonitoringPointId(controlItem.getMonitoringPointId());
        row.setEmissionSourceId(controlItem.getEmissionSourceId());
        row.setWaterOutletId(controlItem.getWaterOutletId());
        row.setWasteSourceId(controlItem.getWasteSourceId());
        row.setProgramIndicatorId(indicator == null ? null : indicator.getId());
        row.setProtocolId(protocol.getId());
        row.setProtocolResultId(result.getId());
        row.setIndicatorName(result.getIndicatorName() != null ? result.getIndicatorName()
                : indicator != null ? indicator.getIndicatorName() : null);
        row.setIndicatorCode(indicator != null ? indicator.getIndicatorCode() : result.getPollutantCode());
        row.setMeasurementDate(result.getSampleDate() != null ? result.getSampleDate() : protocol.getProtocolDate());
        row.setMeasurementMethod(result.getTestingMethodNd() != null ? result.getTestingMethodNd()
                : indicator != null ? null : null);

        applyNormativeAndActual(row, tableType, controlItem, indicator, result);

        boolean hasExceedance = exceedance != null;
        row.setExceedance(hasExceedance);
        row.setExceedanceRatio(exceedance != null ? exceedance.getExceedanceRatio() : null);
        row.setCorrectiveAction(exceedance != null ? exceedance.getCorrectiveAction() : null);
        row.setComment(exceedance != null ? exceedance.getComment() : null);
        row.setSourceType(source.getMatchType());
        row.setSourceVersion(source.getSourceVersion());
        if (tableType == PekOfficialTableType.CALCULATED_EMISSIONS) {
            row.setCalculationMethod(result.getTestingMethodNd());
        }
        return row;
    }

    /**
     * Resolves the (normative, actual, unit) triple from whichever typed ProtocolResult column
     * matches this row's table (emissions use pdvGs/resultGs, wastewater uses pdsMgDm3/
     * resultMgDm3, ambient air uses pdkMgM3/resultMgM3), falling back to the generic
     * normativeValue/resultValue/unit columns - and, for emissions, derives т/год from the
     * emission source's declared operating hours per year.
     */
    private void applyNormativeAndActual(PekReportResultRow row, PekOfficialTableType tableType,
                                          PekProgramControlItem controlItem, PekProgramIndicator indicator,
                                          ProtocolResult result) {
        BigDecimal normative;
        BigDecimal actual;
        String unit;
        switch (tableType) {
            case EMISSIONS, CALCULATED_EMISSIONS -> {
                normative = firstNonNull(result.getPdvGs(), indicator == null ? null : indicator.getNormativeValue());
                actual = firstNonNull(result.getResultGs(), result.getResultValue());
                unit = "г/с";
                row.setNormativeGs(result.getPdvGs());
                row.setActualGs(result.getResultGs());
                applyEmissionMass(row, controlItem);
            }
            case WASTEWATER, MARINE -> {
                normative = firstNonNull(result.getPdsMgDm3(), indicator == null ? null : indicator.getNormativeValue());
                actual = firstNonNull(result.getResultMgDm3(), result.getResultValue());
                unit = "мг/дм3";
            }
            case AMBIENT_AIR -> {
                normative = firstNonNull(result.getPdkMgM3(),
                        firstNonNull(result.getPdkOrBackground(), indicator == null ? null : indicator.getNormativeValue()));
                actual = firstNonNull(result.getResultMgM3(), result.getResultValue());
                unit = "мг/м3";
            }
            default -> {
                normative = indicator != null ? indicator.getNormativeValue() : null;
                actual = result.getResultValue();
                unit = result.getUnit() != null ? result.getUnit() : indicator != null ? indicator.getUnit() : null;
            }
        }
        row.setNormativeValue(normative);
        row.setActualValue(actual);
        row.setUnit(unit != null ? unit : result.getUnit());
        row.setNormativeUnit(unit);
    }

    /** t/year = g/s * hours/year * 3600 / 1,000,000. t/quarter is a straight quarter-of-year split
     *  of the annualized figure (this codebase has no per-quarter operating-hours breakdown to
     *  derive it from more precisely) - documented approximation, not a measured quantity. */
    private void applyEmissionMass(PekReportResultRow row, PekProgramControlItem controlItem) {
        if (controlItem.getEmissionSourceId() == null) {
            return;
        }
        PekEmissionSource source = emissionSourceRepository.findById(controlItem.getEmissionSourceId()).orElse(null);
        if (source == null || source.getOperatingHoursPerYear() == null) {
            return;
        }
        row.setEquipmentOperatingHours(source.getOperatingHoursPerYear());
        BigDecimal hours = BigDecimal.valueOf(source.getOperatingHoursPerYear());
        if (row.getNormativeGs() != null) {
            row.setNormativeTonsYear(tonsPerYear(row.getNormativeGs(), hours));
        }
        if (row.getActualGs() != null) {
            BigDecimal tonsYear = tonsPerYear(row.getActualGs(), hours);
            row.setActualTonsYear(tonsYear);
            row.setActualTonsQuarter(tonsYear.divide(BigDecimal.valueOf(4), 6, RoundingMode.HALF_UP));
        }
    }

    private static BigDecimal tonsPerYear(BigDecimal gramsPerSecond, BigDecimal hoursPerYear) {
        return gramsPerSecond.multiply(hoursPerYear).multiply(SECONDS_PER_HOUR)
                .divide(GRAMS_PER_TON, 6, RoundingMode.HALF_UP);
    }

    private static BigDecimal firstNonNull(BigDecimal a, BigDecimal b) {
        return a != null ? a : b;
    }

    // ============================================================================================
    // Read (endpoint, readiness, renderer) ----------------------------------------------------
    // ============================================================================================

    /** Which of the 9 official table types this program/object declares, from its active
     *  monitoring directions - the exact rule {@link PekProgramReadinessService} and the previous
     *  official-document applicability check both already use. */
    @Transactional(readOnly = true)
    public Set<PekOfficialTableType> applicableTableTypes(PekProgram program, CompanyObject object) {
        if (program == null) {
            return EnumSet.noneOf(PekOfficialTableType.class);
        }
        boolean marine = object != null && object.getSpecialMonitoringType() == SpecialMonitoringType.CASPIAN_MARINE;
        Set<PekMonitoringType> declared = monitoringRepository
                .findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId()).stream()
                .map(PekProgramMonitoring::getMonitoringType)
                .collect(java.util.stream.Collectors.toSet());
        Set<PekOfficialTableType> applicable = EnumSet.noneOf(PekOfficialTableType.class);
        if (declared.contains(PekMonitoringType.EMISSION_SOURCE)) {
            applicable.add(PekOfficialTableType.EMISSIONS);
            applicable.add(PekOfficialTableType.CALCULATED_EMISSIONS);
        }
        if (declared.contains(PekMonitoringType.AMBIENT_AIR)) {
            applicable.add(PekOfficialTableType.AMBIENT_AIR);
        }
        if (declared.contains(PekMonitoringType.WASTEWATER)) {
            applicable.add(marine ? PekOfficialTableType.MARINE : PekOfficialTableType.WASTEWATER);
        }
        if (declared.contains(PekMonitoringType.SURFACE_WATER) || declared.contains(PekMonitoringType.GROUNDWATER)) {
            applicable.add(marine ? PekOfficialTableType.MARINE : PekOfficialTableType.WATER);
        }
        if (declared.contains(PekMonitoringType.SOIL)) {
            applicable.add(PekOfficialTableType.SOIL);
        }
        if (declared.contains(PekMonitoringType.PHYSICAL_FACTOR)) {
            applicable.add(PekOfficialTableType.INSTRUMENTAL_MEASUREMENTS);
            applicable.add(PekOfficialTableType.RADIATION);
        }
        return applicable;
    }

    /** Persisted rows for {@code reportId}, grouped by table type - the input both the renderer and
     *  readiness checks work from. */
    @Transactional(readOnly = true)
    public Map<PekOfficialTableType, List<PekReportResultRow>> loadRowsByTable(Long reportId) {
        Map<PekOfficialTableType, List<PekReportResultRow>> byType = new EnumMap<>(PekOfficialTableType.class);
        for (PekReportResultRow row : resultRowRepository.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(reportId)) {
            byType.computeIfAbsent(row.getSectionType(), t -> new ArrayList<>()).add(row);
        }
        return byType;
    }

    @Transactional(readOnly = true)
    public PekApiDtos.OfficialReportData getOfficialData(Long reportId, PekReport report,
                                                          PekApiDtos.ReadinessResponse readiness) {
        PekProgram program = programRepository.findById(report.getProgramId()).orElse(null);
        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);
        Map<PekOfficialTableType, List<PekReportResultRow>> byType = loadRowsByTable(reportId);
        Set<PekOfficialTableType> applicable = applicableTableTypes(program, object);

        PekApiDtos.OfficialGeneralInfo general = new PekApiDtos.OfficialGeneralInfo(
                company == null ? null : company.getName(),
                program == null ? null : firstNonBlank(program.getBinSnapshot(), company == null ? null : company.getBin()),
                object == null ? null : object.getName(),
                program == null ? null : program.getKato(),
                program == null ? null : program.getOked(),
                program == null ? null : program.getEnvironmentalCategory(),
                object == null ? null : object.getCoordinates(),
                program == null ? null : program.getDesignCapacity(),
                report.getActualCapacity(), report.getActualCapacityUnit(),
                program == null ? null : program.getNumber(), program == null ? null : program.getName(),
                report.getRegulationVersion(), report.getRegulationCode(), report.getTemplateVersion(),
                report.getPeriodStart() == null ? null : report.getPeriodStart().toString(),
                report.getPeriodEnd() == null ? null : report.getPeriodEnd().toString(),
                report.getSubmissionDueDate() == null ? null : report.getSubmissionDueDate().toString());

        PekApiDtos.LaboratorySnapshotDto laboratory = laboratorySnapshot(report);

        List<PekApiDtos.TableApplicability> applicability = new ArrayList<>();
        for (PekOfficialTableType type : PekOfficialTableType.values()) {
            boolean isApplicable = applicable.contains(type);
            applicability.add(new PekApiDtos.TableApplicability(type.name(), isApplicable,
                    isApplicable ? null : "Направление мониторинга не заявлено в программе"));
        }

        // Item 4: one batch Protocol lookup for every row in this report, instead of a per-row
        // findById inside each mapper - see protocolNumbersById.
        Set<Long> protocolIds = byType.values().stream().flatMap(List::stream)
                .map(PekReportResultRow::getProtocolId).filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, String> protocolNumbersById = protocolIds.isEmpty() ? Map.of()
                : protocolRepository.findAllById(protocolIds).stream()
                        .collect(java.util.stream.Collectors.toMap(Protocol::getId, Protocol::getProtocolNumber));

        PekApiDtos.OfficialTables tables = new PekApiDtos.OfficialTables(
                emissionRows(byType.get(PekOfficialTableType.EMISSIONS), protocolNumbersById),
                resultRows(byType.get(PekOfficialTableType.INSTRUMENTAL_MEASUREMENTS), protocolNumbersById),
                calculatedEmissionRows(byType.get(PekOfficialTableType.CALCULATED_EMISSIONS), protocolNumbersById),
                resultRows(byType.get(PekOfficialTableType.AMBIENT_AIR), protocolNumbersById),
                wastewaterRows(byType.get(PekOfficialTableType.WASTEWATER), protocolNumbersById),
                resultRows(byType.get(PekOfficialTableType.WATER), protocolNumbersById),
                resultRows(byType.get(PekOfficialTableType.SOIL), protocolNumbersById),
                resultRows(byType.get(PekOfficialTableType.RADIATION), protocolNumbersById),
                wastewaterRows(byType.get(PekOfficialTableType.MARINE), protocolNumbersById));

        return new PekApiDtos.OfficialReportData(general, laboratory, applicability, tables,
                readiness.ready(), readiness.progressPercent());
    }

    @Transactional(readOnly = true)
    public PekApiDtos.LaboratorySnapshotDto laboratorySnapshot(PekReport report) {
        if (!report.hasLaboratorySnapshot()) {
            return null;
        }
        return new PekApiDtos.LaboratorySnapshotDto(
                report.getLaboratoryIdSnapshot(), report.getLaboratoryNameSnapshot(), report.getLaboratoryBinSnapshot(),
                report.getAccreditationNumberSnapshot(),
                report.getAccreditationValidFromSnapshot() == null ? null : report.getAccreditationValidFromSnapshot().toString(),
                report.getAccreditationValidUntilSnapshot() == null ? null : report.getAccreditationValidUntilSnapshot().toString(),
                report.getAccreditationScopeSnapshot());
    }

    private List<PekApiDtos.ResultRow> resultRows(List<PekReportResultRow> rows, Map<Long, String> protocolNumbersById) {
        if (rows == null) {
            return List.of();
        }
        return rows.stream().map(r -> new PekApiDtos.ResultRow(
                r.getControlItemId(), r.getMonitoringPointId(), pointName(r.getMonitoringPointId()),
                r.getIndicatorName(), r.getIndicatorCode(),
                r.getMeasurementDate() == null ? null : r.getMeasurementDate().toString(),
                r.getMeasurementMethod(), plain(r.getNormativeValue()), plain(r.getActualValue()), r.getUnit(),
                r.isExceedance(), plain(r.getExceedanceRatio()), r.getCorrectiveAction(),
                protocolNumbersById.get(r.getProtocolId()), r.getProtocolId(), r.getProtocolResultId()))
                .toList();
    }

    private List<PekApiDtos.EmissionResultRow> emissionRows(List<PekReportResultRow> rows, Map<Long, String> protocolNumbersById) {
        if (rows == null) {
            return List.of();
        }
        return rows.stream().map(r -> new PekApiDtos.EmissionResultRow(
                r.getEmissionSourceId(), emissionSourceName(r.getEmissionSourceId()),
                r.getIndicatorName(), r.getIndicatorCode(),
                plain(r.getNormativeGs()), plain(r.getNormativeTonsYear()),
                plain(r.getActualGs()), plain(r.getActualTonsQuarter()), plain(r.getActualTonsYear()),
                r.isExceedance(), r.getCorrectiveAction(), r.getProtocolId(), r.getProtocolResultId(),
                protocolNumbersById.get(r.getProtocolId())))
                .toList();
    }

    private List<PekApiDtos.CalculatedEmissionResultRow> calculatedEmissionRows(List<PekReportResultRow> rows,
                                                                                  Map<Long, String> protocolNumbersById) {
        if (rows == null) {
            return List.of();
        }
        return rows.stream().map(r -> new PekApiDtos.CalculatedEmissionResultRow(
                r.getEmissionSourceId(), emissionSourceName(r.getEmissionSourceId()),
                r.getIndicatorName(), r.getIndicatorCode(),
                plain(r.getNormativeGs()), plain(r.getNormativeTonsYear()),
                plain(r.getActualGs()), plain(r.getActualTonsQuarter()), plain(r.getActualTonsYear()),
                r.isExceedance(), r.getCorrectiveAction(), r.getProtocolId(), r.getProtocolResultId(),
                protocolNumbersById.get(r.getProtocolId()),
                r.getCalculationMethod(), r.getRawMaterialName(), plain(r.getRawMaterialConsumptionTons()),
                r.getEquipmentOperatingHours() == null ? null : r.getEquipmentOperatingHours().toString()))
                .toList();
    }

    private List<PekApiDtos.WastewaterResultRow> wastewaterRows(List<PekReportResultRow> rows, Map<Long, String> protocolNumbersById) {
        if (rows == null) {
            return List.of();
        }
        return rows.stream().map(r -> new PekApiDtos.WastewaterResultRow(
                r.getWaterOutletId(), dischargeSourceName(r.getWaterOutletId()),
                r.getIndicatorName(), r.getIndicatorCode(),
                plain(r.getNormativeValue()), r.getNormativeUnit(), plain(r.getNormativeTonsYear()),
                plain(r.getActualValue()), plain(r.getActualTonsQuarter()), plain(r.getActualTonsYear()),
                r.isExceedance(), r.getCorrectiveAction(), r.getProtocolId(), r.getProtocolResultId(),
                protocolNumbersById.get(r.getProtocolId())))
                .toList();
    }

    private String emissionSourceName(Long emissionSourceId) {
        return emissionSourceId == null ? null
                : emissionSourceRepository.findById(emissionSourceId).map(PekEmissionSource::getName).orElse(null);
    }

    private String dischargeSourceName(Long waterOutletId) {
        return waterOutletId == null ? null
                : dischargeSourceRepository.findById(waterOutletId).map(PekDischargeSource::getName).orElse(null);
    }

    private String pointName(Long monitoringPointId) {
        return monitoringPointId == null ? null
                : monitoringPointRepository.findById(monitoringPointId).map(PekMonitoringPoint::getName).orElse(null);
    }

    private static String plain(BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros().toPlainString();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    // ============================================================================================
    // Readiness (additive checks, called by PekReportReadinessService) ------------------------
    // ============================================================================================

    /** Additional issues specific to the official report - appended by
     *  {@link PekReportReadinessService#evaluate}, never replacing its existing PLAN/FACT/sources/
     *  exceedances checks.
     *
     * @param strict when false ({@link PekSettings#isRequireOfficialReportComplete()} unset - the
     *               default for every existing company), every issue below is downgraded to a
     *               non-blocking warning: it is computed and surfaced (module spec: readiness stays
     *               the single source of truth for what is missing), but does not stop submit/
     *               approve/activate for a company that has not explicitly opted into the stricter
     *               gate - the same opt-in convention as every other blockSubmitWith* setting.
     */
    @Transactional(readOnly = true)
    public List<PekApiDtos.ReadinessIssue> officialReadinessIssues(PekReport report, boolean strict) {
        List<PekApiDtos.ReadinessIssue> issues = new ArrayList<>();
        PekProgram program = programRepository.findById(report.getProgramId()).orElse(null);
        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);

        boolean generalComplete = program != null && company != null
                && !blank(company.getName()) && !blank(firstNonBlank(program.getBinSnapshot(), company.getBin()))
                && !blank(program.getKato()) && !blank(program.getOked()) && !blank(program.getEnvironmentalCategory());
        blocking(issues, !generalComplete, "GENERAL_DATA_COMPLETE", "GENERAL",
                "Не заполнены общие сведения об объекте (КАТО/ОКЭД/категория/БИН)");
        blocking(issues, blank(report.getActualCapacity()), "ACTUAL_CAPACITY_REQUIRED", "GENERAL",
                "Не указана фактическая мощность за отчётный период");

        Map<PekOfficialTableType, List<PekReportResultRow>> byType = loadRowsByTable(report.getId());
        int totalRows = byType.values().stream().mapToInt(List::size).sum();

        blocking(issues, totalRows > 0 && !report.hasLaboratorySnapshot(), "LABORATORY_REQUIRED", "LABORATORY",
                "Не удалось определить лабораторию, выполнившую измерения");
        if (report.hasLaboratorySnapshot()) {
            boolean accreditationOk = !blank(report.getAccreditationNumberSnapshot())
                    && (report.getAccreditationValidUntilSnapshot() == null
                        || !report.getAccreditationValidUntilSnapshot().isBefore(reportEnd(report)));
            blocking(issues, !accreditationOk, "ACCREDITATION_REQUIRED", "LABORATORY",
                    "Аттестат аккредитации лаборатории отсутствует или не действует на конец отчётного периода");
        }

        Set<PekOfficialTableType> applicable = applicableTableTypes(program, object);
        blocking(issues, !applicable.isEmpty() && totalRows == 0, "OFFICIAL_TABLES_GENERATED", "OFFICIAL_TABLES",
                "Не сформировано ни одной официальной таблицы отчёта - выполните сбор данных (collect)");
        for (PekOfficialTableType type : applicable) {
            List<PekReportResultRow> rows = byType.getOrDefault(type, List.of());
            blocking(issues, rows.isEmpty(), "REQUIRED_TABLE_INCOMPLETE", "OFFICIAL_TABLES",
                    "Применимая таблица \"" + type + "\" не содержит ни одной строки");
            for (PekReportResultRow row : rows) {
                blocking(issues, row.getNormativeValue() == null && row.getNormativeGs() == null,
                        "MISSING_NORMATIVE", "OFFICIAL_TABLES",
                        "Не задан норматив для показателя \"" + row.getIndicatorName() + "\"", row, "normativeValue");
                blocking(issues, row.getActualValue() == null && row.getActualGs() == null,
                        "MISSING_ACTUAL_VALUE", "OFFICIAL_TABLES",
                        "Нет фактического значения для показателя \"" + row.getIndicatorName() + "\"", row, "actualValue");
                blocking(issues, blank(row.getUnit()), "MISSING_UNIT", "OFFICIAL_TABLES",
                        "Не указана единица измерения для показателя \"" + row.getIndicatorName() + "\"", row, "unit");
                boolean needsSource = type == PekOfficialTableType.EMISSIONS || type == PekOfficialTableType.CALCULATED_EMISSIONS;
                blocking(issues, needsSource && row.getEmissionSourceId() == null, "MISSING_SOURCE", "OFFICIAL_TABLES",
                        "Не указан источник выброса для показателя \"" + row.getIndicatorName() + "\"", row, "emissionSourceId");
                boolean needsOutlet = type == PekOfficialTableType.WASTEWATER || type == PekOfficialTableType.MARINE;
                blocking(issues, needsOutlet && row.getWaterOutletId() == null, "MISSING_SOURCE", "OFFICIAL_TABLES",
                        "Не указан выпуск сточных вод для показателя \"" + row.getIndicatorName() + "\"", row, "waterOutletId");
                boolean needsPoint = type == PekOfficialTableType.AMBIENT_AIR || type == PekOfficialTableType.WATER
                        || type == PekOfficialTableType.SOIL;
                blocking(issues, needsPoint && row.getMonitoringPointId() == null, "MISSING_MONITORING_POINT",
                        "OFFICIAL_TABLES", "Не указана точка мониторинга для показателя \"" + row.getIndicatorName() + "\"",
                        row, "monitoringPointId");
                blocking(issues, row.isExceedance() && blank(row.getCorrectiveAction()), "UNRESOLVED_EXCEEDANCE",
                        "EXCEEDANCES", "Превышение по показателю \"" + row.getIndicatorName()
                                + "\" не имеет корректирующего мероприятия", row, "correctiveAction");
            }
        }
        // Every mandatory program indicator under an applicable, declared control item must have
        // produced at least one result row - a mandatory position with zero matched protocols is a
        // real gap, distinct from "the table has some rows but not for this indicator".
        if (program != null) {
            Set<Long> coveredIndicatorIds = byType.values().stream().flatMap(List::stream)
                    .map(PekReportResultRow::getProgramIndicatorId).filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toSet());
            Map<Long, PekProgramControlItem> controlItems = controlItemRepository
                    .findByProgramIdOrderBySortOrderAsc(program.getId()).stream()
                    .collect(java.util.stream.Collectors.toMap(PekProgramControlItem::getId, c -> c));
            for (PekProgramIndicator indicator : indicatorRepository.findByProgramIdOrderBySortOrderAsc(program.getId())) {
                if (!indicator.isMandatory()) {
                    continue;
                }
                PekProgramControlItem ci = controlItems.get(indicator.getControlItemId());
                if (ci == null) {
                    continue;
                }
                PekOfficialTableType type = classify(ci, dummyResult(), object != null
                        && object.getSpecialMonitoringType() == SpecialMonitoringType.CASPIAN_MARINE);
                if (type == null || !applicable.contains(type)) {
                    continue;
                }
                if (!coveredIndicatorIds.contains(indicator.getId())) {
                    blocking(issues, true, "MISSING_PROTOCOL_RESULT", "OFFICIAL_TABLES",
                            "Нет результата протокола для обязательного показателя \""
                                    + indicator.getIndicatorName() + "\"");
                }
            }
        }
        if (strict) {
            return issues;
        }
        return issues.stream()
                .map(i -> new PekApiDtos.ReadinessIssue(i.code(), i.section(), "WARNING", i.message(), false,
                        i.tableType(), i.entityType(), i.entityId(), i.protocolId(), i.protocolResultId(),
                        i.controlItemId(), i.monitoringPointId(), i.field()))
                .toList();
    }

    /** {@link #classify} needs a ProtocolResult only to distinguish CALCULATED emissions and
     *  radiological physical factors - neither distinction matters for the "is this indicator's
     *  table applicable at all" question above, so an empty stand-in is enough. */
    private static ProtocolResult dummyResult() {
        return new ProtocolResult();
    }

    private static LocalDate reportEnd(PekReport report) {
        return report.getPeriodEnd() != null ? report.getPeriodEnd() : LocalDate.now();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static void blocking(List<PekApiDtos.ReadinessIssue> target, boolean condition,
                                  String code, String section, String message) {
        if (condition) {
            target.add(new PekApiDtos.ReadinessIssue(code, section, "ERROR", message, true));
        }
    }

    /** Item 3: same as {@link #blocking(List, boolean, String, String, String)} but attaches the
     *  offending row's location so the frontend can jump straight to it instead of only showing
     *  the message string. */
    private static void blocking(List<PekApiDtos.ReadinessIssue> target, boolean condition,
                                  String code, String section, String message,
                                  PekReportResultRow row, String field) {
        if (condition) {
            target.add(new PekApiDtos.ReadinessIssue(code, section, "ERROR", message, true,
                    row.getSectionType() == null ? null : row.getSectionType().name(), "RESULT_ROW", row.getId(),
                    row.getProtocolId(), row.getProtocolResultId(), row.getControlItemId(),
                    row.getMonitoringPointId(), field));
        }
    }
}
