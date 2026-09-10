package kz.eco.pek.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.PekDischargeSourceRepository;
import kz.eco.pek.PekEmissionSourceRepository;
import kz.eco.pek.PekEnvironmentalPermitRepository;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekMonitoringType;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramEmergencyProcedureRepository;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramInternalInspectionRepository;
import kz.eco.pek.PekProgramMeasurementQaRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramPermitLink;
import kz.eco.pek.PekProgramPermitLinkRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekProgramResponsibilityRepository;
import kz.eco.pek.PekWasteItemRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Assembles and renders the PEK program document (DOCX and PDF).
 *
 * <p>Exists because the report package used to build its "Программа и план ПЭК" files inline from a
 * handful of {@code createParagraph()} calls, producing a DOCX with a title, a number, a period and
 * one line per monitoring direction, and a PDF with the first three of those. Nothing that made it
 * a programme was in either file, so neither could be handed to anyone as one.
 *
 * <p>Unlike report documents, program documents are not versioned into
 * {@code PekReportDocumentVersion}: the program's own {@code contentRevision} already identifies
 * which state of the program a rendering came from, and it is stamped into the document footer.
 */
@Service
public class PekProgramDocumentGenerationService {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final PekProgramRepository programRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final UserRepository userRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;
    private final PekEmissionSourceRepository emissionSourceRepository;
    private final PekDischargeSourceRepository dischargeSourceRepository;
    private final PekWasteItemRepository wasteItemRepository;
    private final PekProgramInternalInspectionRepository inspectionRepository;
    private final PekProgramMeasurementQaRepository qaRepository;
    private final PekProgramEmergencyProcedureRepository emergencyRepository;
    private final PekProgramResponsibilityRepository responsibilityRepository;
    private final PekEnvironmentalPermitRepository permitRepository;
    private final PekProgramPermitLinkRepository permitLinkRepository;

    public PekProgramDocumentGenerationService(PekProgramRepository programRepository,
                                               CompanyRepository companyRepository,
                                               CompanyObjectRepository companyObjectRepository,
                                               UserRepository userRepository,
                                               PekProgramControlItemRepository controlItemRepository,
                                               PekProgramIndicatorRepository indicatorRepository,
                                               PekProgramMonitoringRepository monitoringRepository,
                                               PekMonitoringPointRepository monitoringPointRepository,
                                               PekEmissionSourceRepository emissionSourceRepository,
                                               PekDischargeSourceRepository dischargeSourceRepository,
                                               PekWasteItemRepository wasteItemRepository,
                                               PekProgramInternalInspectionRepository inspectionRepository,
                                               PekProgramMeasurementQaRepository qaRepository,
                                               PekProgramEmergencyProcedureRepository emergencyRepository,
                                               PekProgramResponsibilityRepository responsibilityRepository,
                                               PekEnvironmentalPermitRepository permitRepository,
                                               PekProgramPermitLinkRepository permitLinkRepository) {
        this.programRepository = programRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.userRepository = userRepository;
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.monitoringRepository = monitoringRepository;
        this.monitoringPointRepository = monitoringPointRepository;
        this.emissionSourceRepository = emissionSourceRepository;
        this.dischargeSourceRepository = dischargeSourceRepository;
        this.wasteItemRepository = wasteItemRepository;
        this.inspectionRepository = inspectionRepository;
        this.qaRepository = qaRepository;
        this.emergencyRepository = emergencyRepository;
        this.responsibilityRepository = responsibilityRepository;
        this.permitRepository = permitRepository;
        this.permitLinkRepository = permitLinkRepository;
    }

    @Transactional(readOnly = true)
    public byte[] renderDocx(Long programId) {
        try {
            return PekProgramDocxRenderer.render(buildValues(program(programId)));
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать документ программы ПЭК: " + e.getMessage());
        }
    }

    /** DOCX first, then the same LibreOffice-with-fallback conversion the report documents use -
     *  never a separately hand-built PDF, which is how the package's PDF ended up containing three
     *  lines while its DOCX contained more. */
    @Transactional(readOnly = true)
    public byte[] renderPdf(Long programId) {
        return renderPdfFrom(renderDocx(programId));
    }

    /** For callers that already have the DOCX and would otherwise render the program twice. */
    public byte[] renderPdfFrom(byte[] docx) {
        return PekReportPdfConverter.convert(docx);
    }

    @Transactional(readOnly = true)
    public PekProgramDocValues buildValues(Long programId) {
        return buildValues(program(programId));
    }

    private PekProgram program(Long programId) {
        return programRepository.findById(programId)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + programId));
    }

    private PekProgramDocValues buildValues(PekProgram program) {
        Long programId = program.getId();
        Company company = companyRepository.findById(program.getCompanyId()).orElse(null);
        CompanyObject object = program.getObjectId() == null ? null
                : companyObjectRepository.findById(program.getObjectId()).orElse(null);
        User responsible = program.getResponsibleUserId() == null ? null
                : userRepository.findById(program.getResponsibleUserId()).orElse(null);

        var general = new OfficialPekReportDocValues.GeneralInfo(
                company == null ? null : company.getName(),
                firstNonBlank(program.getBinSnapshot(), company == null ? null : company.getBin()),
                company == null ? null : company.getLegalAddress(),
                company == null ? null : company.getActualAddress(),
                company == null ? null : company.getPhone(),
                object == null ? null : object.getName(),
                object == null ? null : object.getAddress(),
                program.getKato(), program.getOked(), program.getEnvironmentalCategory(),
                object == null ? null : object.getCoordinates(),
                program.getProductionCharacteristics(), program.getDesignCapacity(), program.getActualCapacity(),
                program.getNumber(), program.getName(),
                program.getValidFrom() == null ? null : program.getValidFrom().toString(),
                program.getValidUntil() == null ? null : program.getValidUntil().toString());

        List<Long> linkedPermitIds = permitLinkRepository.findByProgramId(programId).stream()
                .map(PekProgramPermitLink::getPermitId).toList();
        var permits = (linkedPermitIds.isEmpty()
                ? permitRepository.findByPekProgramId(programId)
                : permitRepository.findAllById(linkedPermitIds)).stream()
                .map(p -> new PekReportDocValues.PermitRow(
                        p.getType() == null ? null : p.getType().toString(), p.getNumber(),
                        p.getValidTo() == null ? null : p.getValidTo().toString(),
                        p.getStatus() == null ? null : p.getStatus().name()))
                .toList();

        List<PekProgramMonitoring> directions =
                monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId);
        Map<Long, List<PekMonitoringPoint>> pointsByDirection =
                monitoringPointRepository.findByProgramIdOrderByIdAsc(programId).stream()
                        .collect(Collectors.groupingBy(PekMonitoringPoint::getMonitoringId));
        var monitoringRows = directions.stream()
                .map(d -> {
                    List<PekMonitoringPoint> points = pointsByDirection.getOrDefault(d.getId(), List.of());
                    return new OfficialPekReportDocValues.MonitoringRow(
                            d.getMonitoringType() == null ? null : d.getMonitoringType().name(),
                            d.getName(), d.getMethodology(),
                            d.getFrequencyType() == null ? null : d.getFrequencyType().name(),
                            points.size(),
                            points.stream().map(PekMonitoringPoint::getName).collect(Collectors.joining(", ")));
                })
                .toList();

        List<PekProgramControlItem> controlItems = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        Map<Long, String> controlItemNames = new HashMap<>();
        controlItems.forEach(ci -> controlItemNames.put(ci.getId(), ci.getName()));
        var controlItemRows = controlItems.stream()
                .map(ci -> new PekProgramDocValues.ControlItemRow(
                        ci.getCode(), ci.getName(),
                        ci.getControlType() == null ? null : ci.getControlType().name(),
                        ci.getEnvironmentComponent(),
                        ci.getFrequencyType() == null ? null : ci.getFrequencyType().name(),
                        ci.getPlannedCount() == null ? null : ci.getPlannedCount().toString(),
                        ci.getMeasurementMethod(), ci.getSamplingMethod(),
                        range(ci.getStartDate(), ci.getEndDate())))
                .toList();

        var indicatorRows = indicatorRepository.findByProgramIdOrderBySortOrderAsc(programId).stream()
                .map(i -> new PekProgramDocValues.IndicatorRow(
                        controlItemNames.getOrDefault(i.getControlItemId(), "#" + i.getControlItemId()),
                        i.getIndicatorCode(), i.getIndicatorName(), i.getUnit(),
                        plain(i.getNormativeValue()),
                        i.getComparisonType() == null ? null : i.getComparisonType().name(),
                        range(plain(i.getMinValue()), plain(i.getMaxValue())),
                        i.getMeasurementDeviceType(), i.isMandatory()))
                .toList();

        Set<PekMonitoringType> declared = directions.stream()
                .map(PekProgramMonitoring::getMonitoringType).collect(Collectors.toSet());
        boolean air = declared.contains(PekMonitoringType.AMBIENT_AIR)
                || declared.contains(PekMonitoringType.EMISSION_SOURCE);
        boolean water = declared.contains(PekMonitoringType.WASTEWATER)
                || declared.contains(PekMonitoringType.SURFACE_WATER)
                || declared.contains(PekMonitoringType.GROUNDWATER);
        boolean waste = declared.contains(PekMonitoringType.WASTE);

        var emissionRows = !air ? List.<OfficialPekReportDocValues.EmissionSourceRow>of()
                : emissionSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream()
                        .map(s -> new OfficialPekReportDocValues.EmissionSourceRow(
                                s.getCode(), s.getName(), s.getSourceType(), s.getWorkshopName(),
                                plain(s.getHeightM()), plain(s.getDiameterM()), s.getCoordinates(),
                                s.getGasCleaningEquipment(), plain(s.getCleaningEfficiencyPercent()),
                                s.getOperatingHoursPerYear() == null ? null : s.getOperatingHoursPerYear().toString()))
                        .toList();

        var dischargeRows = !water ? List.<OfficialPekReportDocValues.DischargeSourceRow>of()
                : dischargeSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream()
                        .map(s -> new OfficialPekReportDocValues.DischargeSourceRow(
                                s.getCode(), s.getName(), s.getReceivingWaterBody(), s.getDischargeType(),
                                s.getCoordinates(), plain(s.getPermittedVolume()), s.getVolumeUnit(),
                                s.getTreatmentFacilities()))
                        .toList();

        var wasteRows = !waste ? List.<PekProgramDocValues.WasteCatalogueRow>of()
                : wasteItemRepository.findByProgramIdOrderBySortOrderAscIdAsc(programId).stream()
                        .map(w -> new PekProgramDocValues.WasteCatalogueRow(
                                w.getName(), w.getCode(), w.getHazardClass(),
                                plain(w.getAccumulationLimit()), w.getLimitUnit(),
                                w.getAccumulationPeriodDays() == null ? null : w.getAccumulationPeriodDays().toString(),
                                w.getStorageSiteName(), w.getCoordinates()))
                        .toList();

        var inspectionRows = inspectionRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(i -> new PekProgramDocValues.InspectionRow(
                        i.getPlannedDate() == null ? null : i.getPlannedDate().toString(),
                        i.getInspectionType(),
                        i.getStatus() == null ? null : i.getStatus().name(),
                        userName(i.getResponsibleUserId())))
                .toList();

        var qaRows = qaRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(q -> new PekProgramDocValues.MeasurementQaRow(
                        q.getParameter(), q.getQaProcedure(), q.getFrequency(),
                        q.getLastCheckDate() == null ? null : q.getLastCheckDate().toString(),
                        q.getNextCheckDate() == null ? null : q.getNextCheckDate().toString()))
                .toList();

        var emergencyRows = emergencyRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(e -> new PekProgramDocValues.EmergencyRow(e.getScenario(), e.getActions(), e.getContactPhone()))
                .toList();

        var responsibilityRows = responsibilityRepository.findByProgramIdOrderByIdAsc(programId).stream()
                .map(r -> new PekProgramDocValues.ResponsibilityRow(
                        r.getRoleLabel(), userName(r.getUserId()), r.getDuties()))
                .toList();

        return new PekProgramDocValues(
                program.getNumber(), program.getName(),
                program.getStatus() == null ? null : program.getStatus().name(),
                program.getRegulationCode(), program.getRegulationVersion(), program.getTemplateVersion(),
                program.getValidFrom() == null ? null : program.getValidFrom().toString(),
                program.getValidUntil() == null ? null : program.getValidUntil().toString(),
                LocalDateTime.now().format(DT), program.getContentRevision(),
                general, program.getDescription(), program.getMonitoringScope(),
                permits, monitoringRows, controlItemRows, indicatorRows,
                air, emissionRows, water, dischargeRows, waste, wasteRows,
                inspectionRows, qaRows, emergencyRows, responsibilityRows,
                responsible == null ? null : responsible.getName(),
                company == null ? null : company.getDirectorName());
    }

    private String userName(Long userId) {
        return userId == null ? null : userRepository.findById(userId).map(User::getName).orElse(null);
    }

    private static String range(Object from, Object to) {
        if (from == null && to == null) return null;
        return (from == null ? "—" : from.toString()) + " — " + (to == null ? "—" : to.toString());
    }

    private static String plain(BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros().toPlainString();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
