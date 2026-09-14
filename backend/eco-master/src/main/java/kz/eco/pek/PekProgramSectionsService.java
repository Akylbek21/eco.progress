package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekProgramSectionDtos.EmergencyProcedureDto;
import kz.eco.pek.dto.PekProgramSectionDtos.EmergencyProcedureRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.InternalInspectionDto;
import kz.eco.pek.dto.PekProgramSectionDtos.InternalInspectionRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.MeasurementQaDto;
import kz.eco.pek.dto.PekProgramSectionDtos.MeasurementQaRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.MonitoringPointDto;
import kz.eco.pek.dto.PekProgramSectionDtos.MonitoringPointRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.ResponsibilityDto;
import kz.eco.pek.dto.PekProgramSectionDtos.ResponsibilityRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/** CRUD for the five Правила №250 program sections added in module fix item 4 (monitoring points,
 *  internal inspections, measurement QA, emergency procedures, responsibility structure) - one
 *  service for all five since each is a small, structurally-identical child-of-program table.
 *  Every mutation: requires the program still be editable (same convention as
 *  {@link PekProgramMonitoringService}), requires If-Match (module fix item 3), and bumps
 *  {@code program.contentRevision} via {@link PekProgramContentRevisionService} (module fix item
 *  4's "любое изменение дочернего раздела программы должно увеличивать
 *  program.version/contentRevision"). */
@Service
public class PekProgramSectionsService {

    private final PekProgramRepository programRepository;
    private final PekMonitoringPointRepository pointRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekProgramInternalInspectionRepository inspectionRepository;
    private final PekProgramMeasurementQaRepository qaRepository;
    private final PekProgramEmergencyProcedureRepository emergencyRepository;
    private final PekProgramResponsibilityRepository responsibilityRepository;
    private final PekProgramContentRevisionService revisionService;

    public PekProgramSectionsService(PekProgramRepository programRepository, PekMonitoringPointRepository pointRepository,
                                      PekProgramMonitoringRepository monitoringRepository,
                                      PekProgramInternalInspectionRepository inspectionRepository,
                                      PekProgramMeasurementQaRepository qaRepository,
                                      PekProgramEmergencyProcedureRepository emergencyRepository,
                                      PekProgramResponsibilityRepository responsibilityRepository,
                                      PekProgramContentRevisionService revisionService) {
        this.programRepository = programRepository;
        this.pointRepository = pointRepository;
        this.monitoringRepository = monitoringRepository;
        this.inspectionRepository = inspectionRepository;
        this.qaRepository = qaRepository;
        this.emergencyRepository = emergencyRepository;
        this.responsibilityRepository = responsibilityRepository;
        this.revisionService = revisionService;
    }

    // ---- monitoring points --------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<MonitoringPointDto> listPoints(Long programId, Long monitoringId) {
        program(programId);
        monitoring(programId, monitoringId);
        return pointRepository.findByMonitoringIdOrderByIdAsc(monitoringId).stream().map(this::dto).toList();
    }

    @Transactional
    public MonitoringPointDto createPoint(Long programId, Long monitoringId, MonitoringPointRequest r) {
        PekProgram program = program(programId);
        editable(program);
        monitoring(programId, monitoringId);
        PekMonitoringPoint p = new PekMonitoringPoint();
        p.setProgramId(programId);
        p.setMonitoringId(monitoringId);
        applyPoint(p, r);
        PekMonitoringPoint saved = pointRepository.saveAndFlush(p);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public MonitoringPointDto updatePoint(Long programId, Long id, MonitoringPointRequest r, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekMonitoringPoint p = pointRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Точка мониторинга не найдена: " + id));
        checkVersion(version, p.getVersion());
        applyPoint(p, r);
        p.setUpdatedAt(LocalDateTime.now());
        PekMonitoringPoint saved = pointRepository.saveAndFlush(p);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public void deletePoint(Long programId, Long id, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekMonitoringPoint p = pointRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Точка мониторинга не найдена: " + id));
        checkVersion(version, p.getVersion());
        pointRepository.delete(p);
        revisionService.bump(programId);
    }

    private void applyPoint(PekMonitoringPoint p, MonitoringPointRequest r) {
        if (isBlank(r.name())) throw new BadRequestException("Укажите название точки мониторинга");
        p.setName(r.name().trim());
        p.setCoordinates(r.coordinates());
        p.setDescription(r.description());
    }

    private MonitoringPointDto dto(PekMonitoringPoint p) {
        return new MonitoringPointDto(p.getId(), p.getMonitoringId(), p.getProgramId(), p.getName(),
                p.getCoordinates(), p.getDescription(), p.getVersion());
    }

    // ---- internal inspections -------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<InternalInspectionDto> listInspections(Long programId) {
        program(programId);
        return inspectionRepository.findByProgramIdOrderByIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public InternalInspectionDto createInspection(Long programId, InternalInspectionRequest r) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramInternalInspection e = new PekProgramInternalInspection();
        e.setProgramId(programId);
        applyInspection(e, r);
        PekProgramInternalInspection saved = inspectionRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public InternalInspectionDto updateInspection(Long programId, Long id, InternalInspectionRequest r, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramInternalInspection e = inspectionRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Внутренняя проверка не найдена: " + id));
        checkVersion(version, e.getVersion());
        applyInspection(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        PekProgramInternalInspection saved = inspectionRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public void deleteInspection(Long programId, Long id, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramInternalInspection e = inspectionRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Внутренняя проверка не найдена: " + id));
        checkVersion(version, e.getVersion());
        inspectionRepository.delete(e);
        revisionService.bump(programId);
    }

    private void applyInspection(PekProgramInternalInspection e, InternalInspectionRequest r) {
        e.setPlannedDate(parseDate(r.plannedDate()));
        e.setActualDate(parseDate(r.actualDate()));
        e.setInspectionType(r.inspectionType());
        e.setFindings(r.findings());
        e.setCorrectiveActionRequired(Boolean.TRUE.equals(r.correctiveActionRequired()));
        e.setResponsibleUserId(r.responsibleUserId());
        if (r.status() != null && !r.status().isBlank()) {
            e.setStatus(enumValue(PekInspectionStatus.class, r.status()));
        }
    }

    private InternalInspectionDto dto(PekProgramInternalInspection e) {
        return new InternalInspectionDto(e.getId(), e.getProgramId(),
                e.getPlannedDate() == null ? null : e.getPlannedDate().toString(),
                e.getActualDate() == null ? null : e.getActualDate().toString(),
                e.getInspectionType(), e.getFindings(), e.isCorrectiveActionRequired(),
                e.getResponsibleUserId(), e.getStatus().name(), e.getVersion());
    }

    // ---- measurement QA ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<MeasurementQaDto> listQa(Long programId) {
        program(programId);
        return qaRepository.findByProgramIdOrderByIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public MeasurementQaDto createQa(Long programId, MeasurementQaRequest r) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramMeasurementQa e = new PekProgramMeasurementQa();
        e.setProgramId(programId);
        applyQa(e, r);
        PekProgramMeasurementQa saved = qaRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public MeasurementQaDto updateQa(Long programId, Long id, MeasurementQaRequest r, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramMeasurementQa e = qaRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Процедура QA не найдена: " + id));
        checkVersion(version, e.getVersion());
        applyQa(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        PekProgramMeasurementQa saved = qaRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public void deleteQa(Long programId, Long id, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramMeasurementQa e = qaRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Процедура QA не найдена: " + id));
        checkVersion(version, e.getVersion());
        qaRepository.delete(e);
        revisionService.bump(programId);
    }

    private void applyQa(PekProgramMeasurementQa e, MeasurementQaRequest r) {
        if (isBlank(r.parameter())) throw new BadRequestException("Укажите параметр измерения");
        e.setParameter(r.parameter().trim());
        e.setQaProcedure(r.qaProcedure());
        e.setFrequency(r.frequency());
        e.setResponsibleUserId(r.responsibleUserId());
        e.setLastCheckDate(parseDate(r.lastCheckDate()));
        e.setNextCheckDate(parseDate(r.nextCheckDate()));
    }

    private MeasurementQaDto dto(PekProgramMeasurementQa e) {
        return new MeasurementQaDto(e.getId(), e.getProgramId(), e.getParameter(), e.getQaProcedure(), e.getFrequency(),
                e.getResponsibleUserId(), e.getLastCheckDate() == null ? null : e.getLastCheckDate().toString(),
                e.getNextCheckDate() == null ? null : e.getNextCheckDate().toString(), e.getVersion());
    }

    // ---- emergency procedures -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<EmergencyProcedureDto> listEmergencyProcedures(Long programId) {
        program(programId);
        return emergencyRepository.findByProgramIdOrderByIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public EmergencyProcedureDto createEmergencyProcedure(Long programId, EmergencyProcedureRequest r) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramEmergencyProcedure e = new PekProgramEmergencyProcedure();
        e.setProgramId(programId);
        applyEmergency(e, r);
        PekProgramEmergencyProcedure saved = emergencyRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public EmergencyProcedureDto updateEmergencyProcedure(Long programId, Long id, EmergencyProcedureRequest r, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramEmergencyProcedure e = emergencyRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Процедура на случай ЧС не найдена: " + id));
        checkVersion(version, e.getVersion());
        applyEmergency(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        PekProgramEmergencyProcedure saved = emergencyRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public void deleteEmergencyProcedure(Long programId, Long id, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramEmergencyProcedure e = emergencyRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Процедура на случай ЧС не найдена: " + id));
        checkVersion(version, e.getVersion());
        emergencyRepository.delete(e);
        revisionService.bump(programId);
    }

    private void applyEmergency(PekProgramEmergencyProcedure e, EmergencyProcedureRequest r) {
        if (isBlank(r.scenario())) throw new BadRequestException("Укажите сценарий ЧС");
        e.setScenario(r.scenario().trim());
        e.setActions(r.actions());
        e.setResponsibleUserId(r.responsibleUserId());
        e.setContactPhone(r.contactPhone());
    }

    private EmergencyProcedureDto dto(PekProgramEmergencyProcedure e) {
        return new EmergencyProcedureDto(e.getId(), e.getProgramId(), e.getScenario(), e.getActions(),
                e.getResponsibleUserId(), e.getContactPhone(), e.getVersion());
    }

    // ---- responsibility structure --------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ResponsibilityDto> listResponsibilities(Long programId) {
        program(programId);
        return responsibilityRepository.findByProgramIdOrderByIdAsc(programId).stream().map(this::dto).toList();
    }

    @Transactional
    public ResponsibilityDto createResponsibility(Long programId, ResponsibilityRequest r) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramResponsibility e = new PekProgramResponsibility();
        e.setProgramId(programId);
        applyResponsibility(e, r);
        PekProgramResponsibility saved = responsibilityRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public ResponsibilityDto updateResponsibility(Long programId, Long id, ResponsibilityRequest r, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramResponsibility e = responsibilityRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Роль в структуре ответственности не найдена: " + id));
        checkVersion(version, e.getVersion());
        applyResponsibility(e, r);
        e.setUpdatedAt(LocalDateTime.now());
        PekProgramResponsibility saved = responsibilityRepository.saveAndFlush(e);
        revisionService.bump(programId);
        return dto(saved);
    }

    @Transactional
    public void deleteResponsibility(Long programId, Long id, Long version) {
        PekProgram program = program(programId);
        editable(program);
        PekProgramResponsibility e = responsibilityRepository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Роль в структуре ответственности не найдена: " + id));
        checkVersion(version, e.getVersion());
        responsibilityRepository.delete(e);
        revisionService.bump(programId);
    }

    private void applyResponsibility(PekProgramResponsibility e, ResponsibilityRequest r) {
        if (isBlank(r.roleLabel())) throw new BadRequestException("Укажите роль");
        e.setRoleLabel(r.roleLabel().trim());
        e.setUserId(r.userId());
        e.setDuties(r.duties());
    }

    private ResponsibilityDto dto(PekProgramResponsibility e) {
        return new ResponsibilityDto(e.getId(), e.getProgramId(), e.getRoleLabel(), e.getUserId(), e.getDuties(), e.getVersion());
    }

    // ---- shared helpers -----------------------------------------------------------------------

    private PekProgram program(Long id) {
        return programRepository.findById(id).orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + id));
    }

    private void monitoring(Long programId, Long monitoringId) {
        PekProgramMonitoring m = monitoringRepository.findByIdAndProgramId(monitoringId, programId)
                .orElseThrow(() -> new NotFoundException("Направление мониторинга не найдено: " + monitoringId));
    }

    private void editable(PekProgram p) {
        if (!p.getStatus().isEditable()) {
            throw new ConflictException("Раздел нельзя изменять в текущем статусе программы", "PEK_PROGRAM_NOT_EDITABLE");
        }
    }

    private void checkVersion(Long requestVersion, Long actualVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Требуется версия (заголовок If-Match)", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(actualVersion)) {
            throw ConflictException.versionConflict("Данные были изменены другим сотрудником", "PEK_VERSION_CONFLICT", actualVersion);
        }
    }

    private LocalDate parseDate(String v) {
        return (v == null || v.isBlank()) ? null : LocalDate.parse(v.trim());
    }

    private <T extends Enum<T>> T enumValue(Class<T> c, String v) {
        try {
            return Enum.valueOf(c, v.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимое значение: " + v);
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
