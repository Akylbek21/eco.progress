package kz.eco.pek;

import kz.eco.pek.dto.PekApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
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
        List<PekProgramControlItem> controlItems = controlItemRepository.findByProgramIdOrderBySortOrderAsc(program.getId());
        List<PekProgramIndicator> indicators = indicatorRepository.findByProgramIdOrderBySortOrderAsc(program.getId());
        List<PekProgramMonitoring> monitorings =
                monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId());

        Checks checks = new Checks();

        // ---- General identification -----------------------------------------------------------
        checks.blocking(isBlank(program.getName()),
                "NAME_REQUIRED", "GENERAL", "Не заполнено название программы");
        checks.blocking(program.getObjectId() == null,
                "OBJECT_REQUIRED", "GENERAL", "Не указан объект");
        checks.blocking(program.getValidFrom() == null || program.getValidUntil() == null,
                "PERIOD_REQUIRED", "GENERAL", "Не указан период действия программы");
        checks.blocking(program.getResponsibleUserId() == null,
                "RESPONSIBLE_REQUIRED", "GENERAL", "Не назначен ответственный за программу");

        // ---- Control items ---------------------------------------------------------------------
        checks.blocking(controlItems.isEmpty(),
                "NO_CONTROL_ITEMS", "CONTROL_ITEMS", "Не добавлено ни одной позиции контроля");
        long incompleteControlItems = controlItems.stream()
                .filter(i -> isBlank(i.getCode()) || isBlank(i.getName()) || i.getFrequencyType() == null)
                .count();
        checks.blocking(incompleteControlItems > 0,
                "INCOMPLETE_CONTROL_ITEMS", "CONTROL_ITEMS",
                "Не заполнены обязательные поля у " + incompleteControlItems + " позиций контроля");

        // ---- Mandatory program sections ---------------------------------------------------------
        // Each of these is a section the program is required to contain; none is component-specific,
        // so all apply to every program regardless of which environmental components it covers.
        checks.blocking(indicators.isEmpty(),
                "NO_INDICATORS", "INDICATORS", "Не добавлено ни одного контролируемого показателя");
        checks.blocking(inspectionRepository.findByProgramIdOrderByIdAsc(program.getId()).isEmpty(),
                "NO_INTERNAL_INSPECTIONS", "INTERNAL_INSPECTIONS",
                "Не запланировано ни одной внутренней проверки");
        checks.blocking(qaRepository.findByProgramIdOrderByIdAsc(program.getId()).isEmpty(),
                "NO_MEASUREMENT_QA", "MEASUREMENT_QA",
                "Не заполнены процедуры контроля качества измерений");
        checks.blocking(emergencyRepository.findByProgramIdOrderByIdAsc(program.getId()).isEmpty(),
                "NO_EMERGENCY_PROCEDURES", "EMERGENCY_PROCEDURES",
                "Не заполнены действия на случай ЧС");
        checks.blocking(responsibilityRepository.findByProgramIdOrderByIdAsc(program.getId()).isEmpty(),
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
            Set<Long> monitoringIdWithPoints = new HashSet<>(
                    monitoringPointRepository.findByProgramIdOrderByIdAsc(program.getId())
                            .stream().map(PekMonitoringPoint::getMonitoringId).toList());
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
        List<Long> linkedPermitIds = programPermitLinkRepository.findByProgramId(program.getId())
                .stream().map(PekProgramPermitLink::getPermitId).toList();
        List<PekEnvironmentalPermit> permits = linkedPermitIds.isEmpty()
                ? permitRepository.findByPekProgramId(program.getId())   // backward compat
                : permitRepository.findAllById(linkedPermitIds);
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
