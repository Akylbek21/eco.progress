package kz.eco.pek;

import kz.eco.pek.dto.PekApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Single source of truth for "is this program ready to leave DRAFT / be approved / be activated",
 * used identically by submitReview/approve/activate and reflected in availableActions so the
 * frontend never sees an action enabled that the server would then 409.
 *
 * <h2>Why most checks are blocking</h2>
 * <p>These checks previously fell into two groups: six blocking ones, and a set of WARNING-only
 * ones covering the responsible person, controlled indicators, internal inspections, measurement
 * QA, emergency procedures, the responsibility structure, and the monitoring directions
 * themselves. Because {@code submitReview()}, {@code approve()} and {@code activate()} all gate on
 * {@code requireReady()}, and {@code ready} is computed from blocking issues only, a program could
 * reach APPROVED and then ACTIVE with none of that content present.
 *
 * <p>Those are not optional sections. A PEK program is required to state its controlled
 * indicators, their frequency and control methods, sampling/measurement points, internal
 * inspections, measurement quality assurance, emergency procedures, and the organisational
 * responsibility structure. A program missing them is not a program that should be approvable, so
 * each is now BLOCKING.
 *
 * <h2>Applicability</h2>
 * <p>Blocking must not mean "demand sections the object cannot have" - an object with no
 * wastewater discharge should never be asked for wastewater points. Applicability is derived from
 * the program's ACTIVE monitoring directions ({@link PekProgramMonitoring}): a per-component
 * requirement fires only for components the program actually declares. Program-level requirements
 * (responsible person, indicators, inspections, QA, emergency procedures, responsibility
 * structure) apply to every program regardless of component mix.
 *
 * <p>{@code MISSING_ACTIVE_PERMIT} and {@code LEGACY_TEMPLATE} stay non-blocking: neither is a
 * missing mandatory section. Not every program legally requires a permit, and a legacy-template
 * program is a migration artefact to be surfaced, not a workflow stop.
 */
@Service
public class PekProgramReadinessService {

    private final PekProgramControlItemRepository controlItemRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekEnvironmentalPermitRepository permitRepository;
    private final PekProgramPermitLinkRepository programPermitLinkRepository;
    private final PekProgramInternalInspectionRepository inspectionRepository;
    private final PekProgramMeasurementQaRepository qaRepository;
    private final PekProgramEmergencyProcedureRepository emergencyRepository;
    private final PekProgramResponsibilityRepository responsibilityRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;

    /** Monitoring types where a concrete physical sampling/observation point is required. Types
     *  that use emissionSourceId / waterOutletId / wasteSourceId instead of a generic point are
     *  intentionally excluded. */
    private static final Set<PekMonitoringType> REQUIRES_POINTS = Set.of(
            PekMonitoringType.AMBIENT_AIR,
            PekMonitoringType.SURFACE_WATER,
            PekMonitoringType.GROUNDWATER,
            PekMonitoringType.WASTEWATER,
            PekMonitoringType.SOIL,
            PekMonitoringType.PHYSICAL_FACTOR
    );

    /** Control-item types whose measurement is inherently laboratory/instrumental work - every
     *  such position needs a laboratory of record and a stated measurement method. WASTE and
     *  BIODIVERSITY are administrative/observational, not lab-measured, so they are excluded
     *  (module fix task 2: "laboratory, если лабораторный контроль предусмотрен"). */
    private static final Set<PekControlType> REQUIRES_LAB = Set.of(
            PekControlType.EMISSION,
            PekControlType.AMBIENT_AIR,
            PekControlType.WATER_INTAKE,
            PekControlType.WASTEWATER,
            PekControlType.SOIL,
            PekControlType.PHYSICAL_FACTOR
    );

    public PekProgramReadinessService(PekProgramControlItemRepository controlItemRepository,
                                       PekProgramIndicatorRepository indicatorRepository,
                                       PekEnvironmentalPermitRepository permitRepository,
                                       PekProgramPermitLinkRepository programPermitLinkRepository,
                                       PekProgramInternalInspectionRepository inspectionRepository,
                                       PekProgramMeasurementQaRepository qaRepository,
                                       PekProgramEmergencyProcedureRepository emergencyRepository,
                                       PekProgramResponsibilityRepository responsibilityRepository,
                                       PekProgramMonitoringRepository monitoringRepository,
                                       PekMonitoringPointRepository monitoringPointRepository) {
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.permitRepository = permitRepository;
        this.programPermitLinkRepository = programPermitLinkRepository;
        this.inspectionRepository = inspectionRepository;
        this.qaRepository = qaRepository;
        this.emergencyRepository = emergencyRepository;
        this.responsibilityRepository = responsibilityRepository;
        this.monitoringRepository = monitoringRepository;
        this.monitoringPointRepository = monitoringPointRepository;
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ReadinessResponse evaluate(PekProgram program) {
        return evaluateAll(List.of(program)).get(program.getId());
    }

    /**
     * Batch readiness for a page of programs: every section is loaded with ONE query per section
     * for all programs ({@code programId IN (...)}), not one per program. This is the single source
     * of the readiness percentage - list, detail, availableActions and /readiness all go through it,
     * so one data revision always yields one number.
     *
     * @return programId -&gt; readiness, in the iteration order of {@code programs}
     */
    @Transactional(readOnly = true)
    public Map<Long, PekApiDtos.ReadinessResponse> evaluateAll(Collection<PekProgram> programs) {
        Map<Long, PekApiDtos.ReadinessResponse> result = new LinkedHashMap<>();
        if (programs == null || programs.isEmpty()) {
            return result;
        }
        List<Long> ids = programs.stream().map(PekProgram::getId).filter(Objects::nonNull).distinct().toList();
        Map<Long, List<PekProgramControlItem>> controlItems = group(controlItemRepository.findByProgramIdIn(ids),
                PekProgramControlItem::getProgramId);
        Map<Long, List<PekProgramIndicator>> indicators = group(indicatorRepository.findByProgramIdIn(ids),
                PekProgramIndicator::getProgramId);
        Map<Long, List<PekProgramMonitoring>> monitorings = group(monitoringRepository.findByProgramIdInAndActiveTrue(ids),
                PekProgramMonitoring::getProgramId);
        Set<Long> withInspections = programIdsOf(inspectionRepository.findByProgramIdIn(ids), PekProgramInternalInspection::getProgramId);
        Set<Long> withQa = programIdsOf(qaRepository.findByProgramIdIn(ids), PekProgramMeasurementQa::getProgramId);
        Set<Long> withEmergency = programIdsOf(emergencyRepository.findByProgramIdIn(ids), PekProgramEmergencyProcedure::getProgramId);
        Set<Long> withResponsibility = programIdsOf(responsibilityRepository.findByProgramIdIn(ids), PekProgramResponsibility::getProgramId);
        Map<Long, List<PekMonitoringPoint>> points = group(monitoringPointRepository.findByProgramIdIn(ids),
                PekMonitoringPoint::getProgramId);
        Map<Long, List<PekProgramPermitLink>> links = group(programPermitLinkRepository.findByProgramIdIn(ids),
                PekProgramPermitLink::getProgramId);
        Map<Long, PekEnvironmentalPermit> linkedPermits = new HashMap<>();
        List<Long> allLinkedPermitIds = links.values().stream().flatMap(List::stream)
                .map(PekProgramPermitLink::getPermitId).distinct().toList();
        if (!allLinkedPermitIds.isEmpty()) {
            permitRepository.findAllById(allLinkedPermitIds).forEach(p -> linkedPermits.put(p.getId(), p));
        }
        Map<Long, List<PekEnvironmentalPermit>> legacyPermits = group(permitRepository.findByPekProgramIdIn(ids),
                PekEnvironmentalPermit::getPekProgramId);

        for (PekProgram program : programs) {
            Long id = program.getId();
            List<PekProgramPermitLink> programLinks = links.getOrDefault(id, List.of());
            List<PekEnvironmentalPermit> permits = programLinks.isEmpty()
                    ? legacyPermits.getOrDefault(id, List.of())   // backward compat: pre-M:N programs
                    : programLinks.stream().map(l -> linkedPermits.get(l.getPermitId())).filter(Objects::nonNull).toList();
            List<PekProgramControlItem> items = new ArrayList<>(controlItems.getOrDefault(id, List.of()));
            items.sort(java.util.Comparator.comparingInt(PekProgramControlItem::getSortOrder));
            result.put(id, evaluate(program, new ProgramData(items,
                    indicators.getOrDefault(id, List.of()),
                    monitorings.getOrDefault(id, List.of()).stream()
                            .sorted(java.util.Comparator.comparing(m -> String.valueOf(m.getMonitoringType())))
                            .toList(),
                    withInspections.contains(id), withQa.contains(id), withEmergency.contains(id),
                    withResponsibility.contains(id),
                    points.getOrDefault(id, List.of()).stream().map(PekMonitoringPoint::getMonitoringId).collect(java.util.stream.Collectors.toSet()),
                    permits)));
        }
        return result;
    }

    private record ProgramData(List<PekProgramControlItem> controlItems, List<PekProgramIndicator> indicators,
                               List<PekProgramMonitoring> monitorings, boolean hasInspections, boolean hasQa,
                               boolean hasEmergency, boolean hasResponsibility, Set<Long> monitoringIdsWithPoints,
                               List<PekEnvironmentalPermit> permits) {
    }

    private static <T> Map<Long, List<T>> group(List<T> rows, java.util.function.Function<T, Long> key) {
        Map<Long, List<T>> grouped = new HashMap<>();
        for (T row : rows) {
            grouped.computeIfAbsent(key.apply(row), k -> new ArrayList<>()).add(row);
        }
        return grouped;
    }

    private static <T> Set<Long> programIdsOf(List<T> rows, java.util.function.Function<T, Long> key) {
        Set<Long> ids = new HashSet<>();
        rows.forEach(r -> ids.add(key.apply(r)));
        return ids;
    }

    private PekApiDtos.ReadinessResponse evaluate(PekProgram program, ProgramData data) {
        List<PekProgramControlItem> controlItems = data.controlItems();
        List<PekProgramIndicator> indicators = data.indicators();
        List<PekProgramMonitoring> monitorings = data.monitorings();

        Checks checks = new Checks();

        // ---- General identification -----------------------------------------------------------
        checks.blocking(isBlank(program.getName()),
                "NAME_REQUIRED", "GENERAL", "Не заполнено название программы");
        checks.blocking(program.getCompanyId() == null,
                "COMPANY_REQUIRED", "GENERAL", "Не указана компания");
        checks.blocking(program.getObjectId() == null,
                "OBJECT_REQUIRED", "GENERAL", "Не указан объект");
        checks.blocking(program.getValidFrom() == null || program.getValidUntil() == null,
                "PERIOD_REQUIRED", "GENERAL", "Не указан период действия программы");
        checks.blocking(program.getResponsibleUserId() == null,
                "RESPONSIBLE_REQUIRED", "GENERAL", "Не назначен ответственный за программу");

        // ---- Facility/master-data snapshot (module fix task 2) ---------------------------------
        // These live as columns directly on PekProgram (facility snapshot, item 1/V109) - no extra
        // Company/CompanyObject lookup needed here, the program row IS the source of truth once
        // stamped at create/edit time.
        checks.blocking(isBlank(program.getBinSnapshot()),
                "BIN_REQUIRED", "GENERAL", "Не указан БИН");
        checks.blocking(isBlank(program.getKato()),
                "KATO_REQUIRED", "GENERAL", "Не указан код КАТО");
        checks.blocking(isBlank(program.getOked()),
                "OKED_REQUIRED", "GENERAL", "Не указан код ОКЭД");
        checks.blocking(isBlank(program.getEnvironmentalCategory()),
                "CATEGORY_REQUIRED", "GENERAL", "Не указана категория объекта");
        checks.blocking(isBlank(program.getDesignCapacity()) || isBlank(program.getDesignCapacityUnit()),
                "DESIGN_CAPACITY_REQUIRED", "GENERAL", "Не указана проектная мощность (значение и единица измерения)");
        checks.blocking(isBlank(program.getFacilityInformation()),
                "FACILITY_INFORMATION_REQUIRED", "GENERAL", "Не заполнены общие сведения об объекте");
        checks.blocking(isBlank(program.getProductionCharacteristics()),
                "PRODUCTION_CHARACTERISTICS_REQUIRED", "GENERAL", "Не заполнена характеристика производства");

        // ---- Regulation/template stamp (module fix task 2 + task 8: never silently blank) ------
        checks.blocking(isBlank(program.getRegulationVersion()),
                "REGULATION_VERSION_REQUIRED", "GENERAL", "Не заполнена версия нормативной базы");
        checks.blocking(isBlank(program.getRegulationCode()),
                "REGULATION_CODE_REQUIRED", "GENERAL", "Не заполнен код нормативной базы");
        checks.blocking(isBlank(program.getTemplateVersion()),
                "TEMPLATE_VERSION_REQUIRED", "GENERAL", "Не заполнена версия шаблона");

        // ---- Control items ---------------------------------------------------------------------
        checks.blocking(controlItems.isEmpty(),
                "NO_CONTROL_ITEMS", "CONTROL_ITEMS", "Не добавлено ни одной позиции контроля");
        long incompleteControlItems = controlItems.stream()
                .filter(i -> isBlank(i.getCode()) || isBlank(i.getName()) || i.getFrequencyType() == null
                        || (REQUIRES_LAB.contains(i.getControlType())
                                && isBlank(i.getMeasurementMethod()) && isBlank(i.getSamplingMethod())))
                .count();
        checks.blocking(incompleteControlItems > 0,
                "INCOMPLETE_CONTROL_ITEMS", "CONTROL_ITEMS",
                "Не заполнены обязательные поля (код/наименование/периодичность/метод) у "
                        + incompleteControlItems + " позиций контроля");
        // Laboratory of record - only for control items whose measurement is actually lab work
        // (module fix: "laboratory, если лабораторный контроль предусмотрен").
        long controlItemsMissingLab = controlItems.stream()
                .filter(i -> REQUIRES_LAB.contains(i.getControlType()) && i.getLaboratoryId() == null)
                .count();
        checks.blocking(controlItemsMissingLab > 0,
                "LABORATORY_REQUIRED", "CONTROL_ITEMS",
                "Не указана лаборатория для " + controlItemsMissingLab + " позиций лабораторного контроля");

        // ---- Mandatory program sections ---------------------------------------------------------
        // Each of these is a section the program is required to contain; none is component-specific,
        // so all apply to every program regardless of which environmental components it covers.
        checks.blocking(indicators.isEmpty(),
                "NO_INDICATORS", "INDICATORS", "Не добавлено ни одного контролируемого показателя");
        checks.blocking(!data.hasInspections(),
                "NO_INTERNAL_INSPECTIONS", "INTERNAL_INSPECTIONS",
                "Не запланировано ни одной внутренней проверки");
        checks.blocking(!data.hasQa(),
                "NO_MEASUREMENT_QA", "MEASUREMENT_QA",
                "Не заполнены процедуры контроля качества измерений");
        checks.blocking(!data.hasEmergency(),
                "NO_EMERGENCY_PROCEDURES", "EMERGENCY_PROCEDURES",
                "Не заполнены действия на случай ЧС");
        checks.blocking(!data.hasResponsibility(),
                "NO_RESPONSIBILITY_STRUCTURE", "RESPONSIBILITY",
                "Не заполнена структура ответственности");

        // ---- Monitoring directions ---------------------------------------------------------------
        // The set of active directions IS the applicability model: a program must declare at least
        // one, and every direction it declares must be complete. Nothing is demanded for a component
        // the program does not declare.
        checks.blocking(monitorings.isEmpty(),
                "NO_MONITORING_DIRECTIONS", "MONITORING",
                "Не добавлено ни одного направления производственного мониторинга");

        if (!monitorings.isEmpty()) {
            long incompleteMonitoring = monitorings.stream()
                    .filter(m -> m.getControlItemIds().isEmpty()
                            || isBlank(m.getMethodology())
                            || m.getFrequencyType() == null)
                    .count();
            checks.blocking(incompleteMonitoring > 0,
                    "INCOMPLETE_MONITORING", "MONITORING",
                    "Не заполнены обязательные поля у " + incompleteMonitoring + " направлений мониторинга"
                            + " (требуются: точки контроля, методология, периодичность)");
        }

        // Applicable only to declared directions whose component is measured at a physical point.
        // A program with no such direction is never asked for monitoring points.
        List<PekProgramMonitoring> pointBearing = monitorings.stream()
                .filter(m -> REQUIRES_POINTS.contains(m.getMonitoringType()))
                .toList();
        if (!pointBearing.isEmpty()) {
            Set<Long> monitoringIdWithPoints = data.monitoringIdsWithPoints();
            List<PekProgramMonitoring> withoutPoints = pointBearing.stream()
                    .filter(m -> !monitoringIdWithPoints.contains(m.getId()))
                    .toList();
            checks.blocking(!withoutPoints.isEmpty(),
                    "MONITORING_POINTS_REQUIRED", "MONITORING",
                    "Не добавлено ни одной точки мониторинга для направлений: "
                            + withoutPoints.stream()
                                    .map(m -> String.valueOf(m.getMonitoringType()))
                                    .distinct()
                                    .reduce((a, b) -> a + ", " + b).orElse(""));
        }

        // ---- Non-blocking signals -----------------------------------------------------------------
        // Permits: read from the M:N join table; fall back to the legacy pekProgramId FK for programs
        // created before that table existed. Warning only when the program has linked permits but
        // none is active today - there is no "requiresPermit" flag to decide the general case.
        List<PekEnvironmentalPermit> permits = data.permits();
        boolean hasActivePermit = permits.stream().anyMatch(p -> p.isActiveOn(java.time.LocalDate.now()));
        checks.warning(!permits.isEmpty() && !hasActivePermit,
                "MISSING_ACTIVE_PERMIT", "PERMITS",
                "Нет действующего разрешения, привязанного к программе ПЭК");
        checks.warning("v1-legacy".equals(program.getTemplateVersion()),
                "LEGACY_TEMPLATE", "GENERAL",
                "Программа использует устаревший шаблон - требуется актуализация");

        // Progress counts applicable blocking checks only, so a program that legitimately skips a
        // non-applicable section is not permanently capped below 100%.
        int progress = checks.applicableBlocking == 0 ? 100
                : BigDecimal.valueOf(Math.max(checks.applicableBlocking - checks.failedBlocking, 0) * 100L)
                        .divide(BigDecimal.valueOf(checks.applicableBlocking), 0, RoundingMode.HALF_UP)
                        .intValue();
        boolean ready = checks.failedBlocking == 0;
        return new PekApiDtos.ReadinessResponse(ready, progress,
                new PekApiDtos.ReadinessSummary(controlItems.size(),
                        controlItems.size() - (int) incompleteControlItems,
                        (int) incompleteControlItems, 0, 0, 0, 0, 0),
                checks.issues);
    }

    /**
     * Accumulates issues while counting how many blocking checks were actually applicable to this
     * program, so {@code progress} has an honest denominator instead of a hardcoded one that drifts
     * every time a check is added.
     */
    private static final class Checks {
        private final List<PekApiDtos.ReadinessIssue> issues = new ArrayList<>();
        private int applicableBlocking;
        private int failedBlocking;

        void blocking(boolean failed, String code, String section, String message) {
            applicableBlocking++;
            if (failed) {
                failedBlocking++;
                issues.add(new PekApiDtos.ReadinessIssue(code, section, "ERROR", message, true));
            }
        }

        void warning(boolean failed, String code, String section, String message) {
            if (failed) {
                issues.add(new PekApiDtos.ReadinessIssue(code, section, "WARNING", message, false));
            }
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
