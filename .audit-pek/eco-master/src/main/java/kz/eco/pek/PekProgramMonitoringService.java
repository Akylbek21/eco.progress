package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekMonitoringDtos;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class PekProgramMonitoringService {

    private static final Set<UserRole> EDIT_ROLES =
            Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST);

    private final PekProgramMonitoringRepository repository;
    private final PekProgramRepository programRepository;
    private final PekProgramControlItemRepository itemRepository;
    private final PekMonitoringProtocolTypeResolver resolver;
    private final PekProgramContentRevisionService revisionService;
    private final PekProgramService programService;

    public PekProgramMonitoringService(PekProgramMonitoringRepository repository, PekProgramRepository programRepository,
                                        PekProgramControlItemRepository itemRepository, PekMonitoringProtocolTypeResolver resolver,
                                        PekProgramContentRevisionService revisionService, PekProgramService programService) {
        this.repository = repository;
        this.programRepository = programRepository;
        this.itemRepository = itemRepository;
        this.resolver = resolver;
        this.revisionService = revisionService;
        this.programService = programService;
    }

    @Transactional(readOnly = true)
    public List<PekMonitoringDtos.Response> list(Long programId) {
        PekProgram program = program(programId);
        return repository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId).stream()
                .map(m -> dto(m, program)).toList();
    }

    /** GET /api/pek/programs/{id}/monitoring - module fix: previously a bare List<Response>, no
     *  programId echo and no list-level availableActions (e.g. "create" - can the current user add
     *  a new monitoring direction to this program right now). Same role+status gate as an
     *  individual row's "edit"/"delete" in {@link #dto}. */
    @Transactional(readOnly = true)
    public PekMonitoringDtos.ListResponse listResponse(Long programId) {
        PekProgram program = program(programId);
        List<PekMonitoringDtos.Response> items = repository
                .findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId).stream()
                .map(m -> dto(m, program)).toList();
        User currentUser = kz.eco.auth.CurrentUser.getOrNull();
        UserRole role = currentUser == null ? null : currentUser.getRole();
        boolean canCreate = role != null && EDIT_ROLES.contains(role) && program.getStatus().isEditable();
        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("create", canCreate);
        return new PekMonitoringDtos.ListResponse(programId, items, actions);
    }

    /** programVersion is the program aggregate's JPA @Version - validated via If-Match on the
     *  program, not the individual monitoring row. This ensures every monitoring mutation is
     *  serialised against the whole program aggregate, increments program.version via
     *  revisionService.bump(), and therefore invalidates any previously generated document
     *  (contentRevision advances, making all earlier document versions stale). */
    @Transactional
    public kz.eco.pek.dto.PekApiDtos.ProgramResponse create(Long programId, PekMonitoringDtos.Request request, Long programVersion) {
        PekProgram program = program(programId);
        checkProgramVersion(program, programVersion);
        editable(program);
        PekMonitoringType type = type(request.monitoringType());
        if (repository.existsByProgramIdAndMonitoringType(programId, type)) {
            throw new ConflictException("Направление уже включено в программу", "PEK_MONITORING_TYPE_EXISTS");
        }
        PekProgramMonitoring m = new PekProgramMonitoring();
        m.setProgramId(programId);
        apply(m, request, type);
        repository.saveAndFlush(m);
        revisionService.bump(programId);
        return programResponse(programId);
    }

    @Transactional
    public kz.eco.pek.dto.PekApiDtos.ProgramResponse update(Long programId, Long id, PekMonitoringDtos.Request request, Long programVersion) {
        PekProgram program = program(programId);
        checkProgramVersion(program, programVersion);
        editable(program);
        PekProgramMonitoring m = find(programId, id);
        apply(m, request, request.monitoringType() == null ? m.getMonitoringType() : type(request.monitoringType()));
        m.setUpdatedAt(LocalDateTime.now());
        repository.saveAndFlush(m);
        revisionService.bump(programId);
        return programResponse(programId);
    }

    @Transactional
    public kz.eco.pek.dto.PekApiDtos.ProgramResponse delete(Long programId, Long id, Long programVersion) {
        PekProgram program = program(programId);
        checkProgramVersion(program, programVersion);
        editable(program);
        PekProgramMonitoring m = find(programId, id);
        m.setActive(false);
        m.setUpdatedAt(LocalDateTime.now());
        repository.saveAndFlush(m);
        revisionService.bump(programId);
        return programResponse(programId);
    }

    /** Builds the full ProgramResponse (version/contentRevision/readiness/availableActions) with
     *  the up-to-date monitoring list embedded, so create/update/delete never need a second
     *  GET .../monitoring round-trip and DELETE never has to answer with a bare data: null. */
    private kz.eco.pek.dto.PekApiDtos.ProgramResponse programResponse(Long programId) {
        PekProgram program = program(programId);
        return programService.toResponse(program, listResponse(programId));
    }

    private void apply(PekProgramMonitoring m, PekMonitoringDtos.Request r, PekMonitoringType type) {
        m.setMonitoringType(type);
        m.setName(blank(r.name()) ? label(type) : r.name().trim());
        m.setMethodology(r.methodology());
        m.setLaboratoryId(r.laboratoryId());
        m.setFrequencyType(r.frequencyType() == null ? null : enumValue(PekFrequencyType.class, r.frequencyType(), "frequencyType"));
        m.setPlannedCount(r.plannedCount());
        m.setActive(r.active() == null || r.active());
        Set<Long> ids = new LinkedHashSet<>(r.controlItemIds() == null ? List.of() : r.controlItemIds());
        for (Long id : ids) {
            PekProgramControlItem i = itemRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Позиция контроля не найдена: " + id));
            if (!i.getProgramId().equals(m.getProgramId())) {
                throw new BadRequestException("Позиция контроля относится к другой программе");
            }
        }
        m.setControlItemIds(ids);
    }

    private PekMonitoringDtos.Response dto(PekProgramMonitoring m, PekProgram program) {
        List<String> missing = new ArrayList<>();
        if (m.getControlItemIds().isEmpty()) missing.add("controlItemIds");
        if (blank(m.getMethodology())) missing.add("methodology");
        if (m.getFrequencyType() == null) missing.add("frequencyType");
        if (m.getFrequencyType() == PekFrequencyType.PER_EVENT && m.getPlannedCount() == null) missing.add("plannedCount");

        User currentUser = kz.eco.auth.CurrentUser.getOrNull();
        UserRole role = currentUser == null ? null : currentUser.getRole();
        boolean canEdit = role != null && EDIT_ROLES.contains(role) && program.getStatus().isEditable();
        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("view", true);
        actions.put("edit", canEdit);
        actions.put("delete", canEdit);

        return new PekMonitoringDtos.Response(m.getId(), m.getProgramId(), m.getMonitoringType().name(), m.getName(),
                m.getMethodology(), m.getLaboratoryId(), m.getFrequencyType() == null ? null : m.getFrequencyType().name(),
                m.getPlannedCount(), List.copyOf(m.getControlItemIds()),
                resolver.resolve(m.getMonitoringType()).stream().map(Enum::name).toList(),
                missing, m.isActive(), m.getVersion(), actions);
    }

    private PekProgram program(Long id) {
        return programRepository.findById(id).orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + id));
    }

    private PekProgramMonitoring find(Long programId, Long id) {
        return repository.findByIdAndProgramId(id, programId)
                .orElseThrow(() -> new NotFoundException("Направление мониторинга не найдено: " + id));
    }

    private void editable(PekProgram p) {
        if (!p.getStatus().isEditable()) {
            throw new ConflictException("Направления нельзя изменять в текущем статусе программы", "PEK_PROGRAM_NOT_EDITABLE");
        }
    }

    private void checkProgramVersion(PekProgram program, Long expected) {
        if (expected == null) {
            throw new BadRequestException("Требуется заголовок If-Match с версией программы", "VERSION_REQUIRED");
        }
        if (!expected.equals(program.getVersion())) {
            throw ConflictException.versionConflict("Программа изменена другим сотрудником — обновите страницу", "PEK_VERSION_CONFLICT", program.getVersion());
        }
    }

    private PekMonitoringType type(String v) {
        return enumValue(PekMonitoringType.class, v, "monitoringType");
    }

    private static <T extends Enum<T>> T enumValue(Class<T> c, String v, String f) {
        try {
            return Enum.valueOf(c, v.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            throw new BadRequestException("Некорректный " + f + ": " + v);
        }
    }

    private static boolean blank(String v) { return v == null || v.isBlank(); }
    private static String label(PekMonitoringType t) { return t.name().replace('_', ' '); }
}
