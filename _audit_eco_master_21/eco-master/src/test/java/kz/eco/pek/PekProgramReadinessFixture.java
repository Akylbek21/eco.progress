package kz.eco.pek;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Fills the sections a PEK program is required to contain before it can be submitted, approved or
 * activated.
 *
 * <p>Those requirements used to be WARNING-only, so a fixture consisting of a single control item
 * could walk all the way to ACTIVE. They are BLOCKING now (see
 * {@link PekProgramReadinessService}), which is exactly the behaviour under test elsewhere - but
 * it also means every test that merely needs an ACTIVE program as a report-side fixture would
 * otherwise have to hand-roll six section payloads it does not care about.
 *
 * <p>Writes go straight through the repositories rather than the section endpoints: these rows are
 * scaffolding, and routing them through the API would drag in If-Match version juggling and
 * contentRevision bumps that the calling test is not asserting on.
 */
@Component
public class PekProgramReadinessFixture {

    private final PekProgramControlItemRepository controlItems;
    private final PekProgramIndicatorRepository indicators;
    private final PekProgramInternalInspectionRepository inspections;
    private final PekProgramMeasurementQaRepository measurementQa;
    private final PekProgramEmergencyProcedureRepository emergencyProcedures;
    private final PekProgramResponsibilityRepository responsibilities;
    private final PekProgramMonitoringRepository monitorings;
    private final PekMonitoringPointRepository monitoringPoints;
    private final PekProgramRepository programs;

    public PekProgramReadinessFixture(PekProgramControlItemRepository controlItems,
                                      PekProgramIndicatorRepository indicators,
                                      PekProgramInternalInspectionRepository inspections,
                                      PekProgramMeasurementQaRepository measurementQa,
                                      PekProgramEmergencyProcedureRepository emergencyProcedures,
                                      PekProgramResponsibilityRepository responsibilities,
                                      PekProgramMonitoringRepository monitorings,
                                      PekMonitoringPointRepository monitoringPoints,
                                      PekProgramRepository programs) {
        this.controlItems = controlItems;
        this.indicators = indicators;
        this.inspections = inspections;
        this.measurementQa = measurementQa;
        this.emergencyProcedures = emergencyProcedures;
        this.responsibilities = responsibilities;
        this.monitorings = monitorings;
        this.monitoringPoints = monitoringPoints;
        this.programs = programs;
    }

    /**
     * Makes {@code programId} pass every blocking readiness check, leaving its status untouched.
     * Idempotent: a section that already has rows is left alone, so calling this on an
     * already-complete program changes nothing.
     */
    public void makeReady(Long programId) {
        makeReady(programId, PekMonitoringType.EMISSION_SOURCE);
    }

    /** As {@link #makeReady(Long)}, but for callers whose own test data occupies a particular
     *  monitoring type - each type may be declared only once per program. */
    public void makeReady(Long programId, PekMonitoringType directionType) {
        PekProgram program = programs.findById(programId).orElseThrow();
        if (program.getResponsibleUserId() == null) {
            // Deliberately not fixed up here: writing to the program row would bump its optimistic
            // version and break callers that pass a known If-Match. Set responsibleUserId in the
            // create payload instead.
            throw new IllegalStateException(
                    "Фикстура готовности требует responsibleUserId в запросе создания программы " + programId);
        }
        List<PekProgramControlItem> items = controlItems.findByProgramIdOrderBySortOrderAsc(programId);
        if (items.isEmpty()) {
            throw new IllegalStateException(
                    "Фикстура готовности требует хотя бы одну позицию контроля у программы " + programId);
        }
        Long controlItemId = items.get(0).getId();

        if (indicators.findByProgramIdOrderBySortOrderAsc(programId).isEmpty()) {
            PekProgramIndicator indicator = new PekProgramIndicator();
            indicator.setProgramId(programId);
            indicator.setControlItemId(controlItemId);
            indicator.setIndicatorName("Взвешенные вещества");
            indicator.setUnit("мг/м3");
            indicators.saveAndFlush(indicator);
        }

        if (inspections.findByProgramIdOrderByIdAsc(programId).isEmpty()) {
            PekProgramInternalInspection inspection = new PekProgramInternalInspection();
            inspection.setProgramId(programId);
            inspection.setPlannedDate(LocalDate.now());
            inspection.setInspectionType("Плановая");
            inspections.saveAndFlush(inspection);
        }

        if (measurementQa.findByProgramIdOrderByIdAsc(programId).isEmpty()) {
            PekProgramMeasurementQa qa = new PekProgramMeasurementQa();
            qa.setProgramId(programId);
            qa.setParameter("Взвешенные вещества");
            qa.setQaProcedure("Поверка средств измерений");
            qa.setFrequency("Ежегодно");
            measurementQa.saveAndFlush(qa);
        }

        if (emergencyProcedures.findByProgramIdOrderByIdAsc(programId).isEmpty()) {
            PekProgramEmergencyProcedure emergency = new PekProgramEmergencyProcedure();
            emergency.setProgramId(programId);
            emergency.setScenario("Аварийный выброс");
            emergency.setActions("Остановить источник, уведомить уполномоченный орган");
            emergencyProcedures.saveAndFlush(emergency);
        }

        if (responsibilities.findByProgramIdOrderByIdAsc(programId).isEmpty()) {
            PekProgramResponsibility responsibility = new PekProgramResponsibility();
            responsibility.setProgramId(programId);
            responsibility.setRoleLabel("Инженер-эколог");
            responsibility.setDuties("Ведение и контроль ПЭК");
            responsibilities.saveAndFlush(responsibility);
        }

        List<PekProgramMonitoring> directions =
                monitorings.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId);
        if (directions.isEmpty()) {
            // The default EMISSION_SOURCE is deliberately not in REQUIRES_POINTS, so the fixture
            // exercises the applicability rule rather than sidestepping it - no monitoring point
            // is demanded for a component that is not measured at one. A REQUIRES_POINTS type
            // passed in here would need addPointBearingDirection instead.
            PekProgramMonitoring direction = new PekProgramMonitoring();
            direction.setProgramId(programId);
            direction.setMonitoringType(directionType);
            direction.setName("Направление " + directionType);
            direction.setMethodology("Инструментальный");
            direction.setFrequencyType(PekFrequencyType.QUARTERLY);
            direction.setControlItemIds(new java.util.LinkedHashSet<>(List.of(controlItemId)));
            monitorings.saveAndFlush(direction);
        }
    }

    /**
     * Adds a direction whose component IS measured at a physical point, plus that point - for
     * tests that need the point-bearing branch of the applicability rule covered.
     */
    public Long addPointBearingDirection(Long programId, PekMonitoringType type) {
        Long controlItemId = controlItems.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId();
        PekProgramMonitoring direction = new PekProgramMonitoring();
        direction.setProgramId(programId);
        direction.setMonitoringType(type);
        direction.setName("Направление " + type);
        direction.setMethodology("Инструментальный");
        direction.setFrequencyType(PekFrequencyType.QUARTERLY);
        direction.setControlItemIds(new java.util.LinkedHashSet<>(List.of(controlItemId)));
        monitorings.saveAndFlush(direction);

        PekMonitoringPoint point = new PekMonitoringPoint();
        point.setMonitoringId(direction.getId());
        point.setProgramId(programId);
        point.setName("Точка №1");
        point.setCoordinates("43.2,76.9");
        monitoringPoints.saveAndFlush(point);
        return direction.getId();
    }
}
