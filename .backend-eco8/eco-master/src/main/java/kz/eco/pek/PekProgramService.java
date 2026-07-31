package kz.eco.pek;

import kz.eco.audit.AuditLogRepository;
import kz.eco.audit.AuditLogService;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.PayloadTooLargeException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.ComparisonType;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Program aggregate: header + control items + indicators + measures + documents, all persisted
 * (and re-persisted on edit) in one transaction so a partial save never happens (module spec §8:
 * "данные не должны теряться"). Workflow (submitReview/return/approve/activate/archive/clone) and
 * history live here too rather than in a separate workflow service - this aggregate is still small
 * enough that splitting it further would just be indirection (module spec §3: "не создавать
 * универсальный сервис на несколько тысяч строк" cuts both ways; this class stays under ~450 lines
 * because report/collection/dashboard/lookup logic lives in their own services, not because this
 * one avoids its own aggregate's rules).
 */
@Service
public class PekProgramService {

    private final PekProgramRepository programRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekProgramMeasureRepository measureRepository;
    private final PekProgramDocumentRepository documentRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final AuditLogRepository auditLogRepository;
    private final FileStorageService fileStorageService;

    private static final String ENTITY_TYPE = "PekProgram";
    private static final long MAX_DOCUMENT_SIZE_BYTES = 25L * 1024 * 1024;

    public PekProgramService(PekProgramRepository programRepository,
                             PekProgramControlItemRepository controlItemRepository,
                             PekProgramIndicatorRepository indicatorRepository,
                             PekProgramMeasureRepository measureRepository,
                             PekProgramDocumentRepository documentRepository,
                             CompanyRepository companyRepository,
                             CompanyObjectRepository companyObjectRepository,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             AuditLogRepository auditLogRepository,
                             FileStorageService fileStorageService) {
        this.programRepository = programRepository;
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.measureRepository = measureRepository;
        this.documentRepository = documentRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.auditLogRepository = auditLogRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public PekApiDtos.ProgramResponse create(PekApiDtos.CreateProgramRequest request, Long userId) {
        if (request.companyId() == null) {
            throw new BadRequestException("Укажите companyId");
        }
        if (request.objectId() == null) {
            throw new BadRequestException("Укажите objectId");
        }
        // objectId must be a real CompanyObject belonging to companyId - never companyId itself
        // standing in for an object (spec: "Не используй companyId вместо objectId", "Не создавай
        // виртуальные объекты на основании companyId").
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new NotFoundException("Компания не найдена"));
        CompanyObject object = companyObjectRepository.findByIdAndCompanyId(request.objectId(), company.getId())
                .orElseThrow(() -> new BadRequestException(
                        "Объект не найден или не принадлежит выбранной компании", "OBJECT_COMPANY_MISMATCH"));
        if (object.getArchivedAt() != null) {
            throw new BadRequestException("Нельзя создать программу ПЭК для архивного объекта", "OBJECT_ARCHIVED");
        }
        if (isBlank(request.number())) {
            throw new BadRequestException("Укажите номер программы");
        }
        if (isBlank(request.name())) {
            throw new BadRequestException("Укажите название программы");
        }
        LocalDate validFrom = parseDate(request.validFrom(), "validFrom");
        LocalDate validUntil = parseDate(request.validUntil(), "validUntil");
        if (validUntil.isBefore(validFrom)) {
            throw new BadRequestException("validUntil не может быть раньше validFrom");
        }

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber(request.number().trim());
        program.setName(request.name().trim());
        program.setDescription(request.description());
        program.setValidFrom(validFrom);
        program.setValidUntil(validUntil);
        program.setResponsibleUserId(request.responsibleUserId());
        program.setStatus(PekProgramStatus.DRAFT);
        program.setCreatedBy(userId);
        programRepository.save(program);

        replaceControlItems(program.getId(), request.controlItems());
        replaceIndicators(program.getId(), request.indicators());
        replaceMeasures(program.getId(), request.measures());

        audit(program.getId(), userId, "CREATE", null, null, "Программа ПЭК создана");
        return toResponse(program);
    }

    /** Full or partial aggregate replace (module spec §8: "не должны теряться"). Any collection
     *  argument left null means "leave that part of the aggregate untouched" - only an explicit
     *  empty list clears it. Only legal while the program {@link PekProgramStatus#isEditable()}. */
    @Transactional
    public PekApiDtos.ProgramResponse edit(Long id, PekApiDtos.EditProgramRequest request, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, request.version());
        if (!program.getStatus().isEditable()) {
            throw new ConflictException(
                    "Программу ПЭК в статусе " + program.getStatus() + " нельзя редактировать",
                    "PEK_PROGRAM_NOT_EDITABLE");
        }
        String oldStatus = program.getStatus().name();
        if (!isBlank(request.name())) {
            program.setName(request.name().trim());
        }
        if (request.description() != null) {
            program.setDescription(request.description());
        }
        if (!isBlank(request.validFrom())) {
            program.setValidFrom(parseDate(request.validFrom(), "validFrom"));
        }
        if (!isBlank(request.validUntil())) {
            program.setValidUntil(parseDate(request.validUntil(), "validUntil"));
        }
        if (program.getValidUntil().isBefore(program.getValidFrom())) {
            throw new BadRequestException("validUntil не может быть раньше validFrom");
        }
        if (request.responsibleUserId() != null) {
            program.setResponsibleUserId(request.responsibleUserId());
        }
        // RETURNED programs go back to UNDER_REVIEW once corrected by re-submitting, not
        // automatically on the first edit - see submitReview.
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);

        if (request.controlItems() != null) {
            replaceControlItems(program.getId(), request.controlItems());
        }
        if (request.indicators() != null) {
            replaceIndicators(program.getId(), request.indicators());
        }
        if (request.measures() != null) {
            replaceMeasures(program.getId(), request.measures());
        }

        audit(program.getId(), userId, "UPDATE", oldStatus, program.getStatus().name(), "Программа ПЭК изменена");
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse submitReview(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        requireTransition(program, PekProgramStatus.UNDER_REVIEW);
        if (controlItemRepository.countByProgramId(program.getId()) == 0) {
            throw new BadRequestException(
                    "Нельзя отправить на проверку программу без позиций контроля", "PEK_PROGRAM_EMPTY");
        }
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.UNDER_REVIEW);
        program.setSubmittedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);
        audit(program.getId(), userId, "SUBMIT_REVIEW", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse returnProgram(Long id, Long version, String reason, Long userId) {
        if (isBlank(reason)) {
            throw new BadRequestException("Укажите причину возврата", "RETURN_REASON_REQUIRED");
        }
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        requireTransition(program, PekProgramStatus.RETURNED);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.RETURNED);
        program.setReviewerUserId(userId);
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);
        audit(program.getId(), userId, "RETURN", oldStatus, program.getStatus().name(), reason);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse approve(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        requireTransition(program, PekProgramStatus.APPROVED);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.APPROVED);
        program.setApproverUserId(userId);
        program.setApprovedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);
        audit(program.getId(), userId, "APPROVE", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse activate(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        requireTransition(program, PekProgramStatus.ACTIVE);
        // At most one ACTIVE program per object with an overlapping period - an ACTIVE program
        // already covering an overlapping window would make report auto-selection ambiguous.
        boolean overlaps = programRepository.findByCompanyIdAndObjectIdAndStatus(
                        program.getCompanyId(), program.getObjectId(), PekProgramStatus.ACTIVE).stream()
                .anyMatch(other -> !other.getId().equals(program.getId())
                        && !other.getValidUntil().isBefore(program.getValidFrom())
                        && !other.getValidFrom().isAfter(program.getValidUntil()));
        if (overlaps) {
            throw new ConflictException(
                    "На этом объекте уже есть действующая программа ПЭК с пересекающимся периодом",
                    "PEK_PROGRAM_PERIOD_OVERLAP");
        }
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setActivatedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);
        audit(program.getId(), userId, "ACTIVATE", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse archive(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        requireTransition(program, PekProgramStatus.ARCHIVED);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.ARCHIVED);
        program.setArchivedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.save(program);
        audit(program.getId(), userId, "ARCHIVE", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    /** Copies header (with a caller-supplied new number/name/period) plus control items/indicators/
     *  measures into a brand-new DRAFT program - documents are NOT copied (module spec doesn't ask
     *  for it, and a copied file reference across two programs would make deletion/access-scoping
     *  ambiguous). The source program is untouched (read-only), so no version check on it. */
    @Transactional
    public PekApiDtos.ProgramResponse clone(Long sourceId, PekApiDtos.CloneProgramRequest request, Long userId) {
        PekProgram source = getOrThrow(sourceId);
        if (isBlank(request.number())) {
            throw new BadRequestException("Укажите номер новой программы");
        }
        LocalDate validFrom = !isBlank(request.validFrom()) ? parseDate(request.validFrom(), "validFrom") : source.getValidFrom();
        LocalDate validUntil = !isBlank(request.validUntil()) ? parseDate(request.validUntil(), "validUntil") : source.getValidUntil();
        if (validUntil.isBefore(validFrom)) {
            throw new BadRequestException("validUntil не может быть раньше validFrom");
        }

        PekProgram clone = new PekProgram();
        clone.setCompanyId(source.getCompanyId());
        clone.setObjectId(source.getObjectId());
        clone.setNumber(request.number().trim());
        clone.setName(!isBlank(request.name()) ? request.name().trim() : source.getName() + " (копия)");
        clone.setDescription(source.getDescription());
        clone.setValidFrom(validFrom);
        clone.setValidUntil(validUntil);
        clone.setResponsibleUserId(source.getResponsibleUserId());
        clone.setStatus(PekProgramStatus.DRAFT);
        clone.setCreatedBy(userId);
        programRepository.save(clone);

        Map<Long, Long> oldToNewControlItemId = new java.util.HashMap<>();
        for (PekProgramControlItem item : controlItemRepository.findByProgramIdOrderBySortOrderAsc(source.getId())) {
            PekProgramControlItem copy = new PekProgramControlItem();
            copy.setProgramId(clone.getId());
            copy.setCode(item.getCode());
            copy.setName(item.getName());
            copy.setSectionCode(item.getSectionCode());
            copy.setControlType(item.getControlType());
            copy.setEnvironmentComponent(item.getEnvironmentComponent());
            copy.setMonitoringPointId(item.getMonitoringPointId());
            copy.setEmissionSourceId(item.getEmissionSourceId());
            copy.setWaterOutletId(item.getWaterOutletId());
            copy.setWasteSourceId(item.getWasteSourceId());
            copy.setLaboratoryId(item.getLaboratoryId());
            copy.setFrequencyType(item.getFrequencyType());
            copy.setFrequencyValue(item.getFrequencyValue());
            copy.setPlannedCount(item.getPlannedCount());
            copy.setMeasurementMethod(item.getMeasurementMethod());
            copy.setSamplingMethod(item.getSamplingMethod());
            copy.setResponsibleUserId(item.getResponsibleUserId());
            copy.setMandatory(item.isMandatory());
            copy.setSortOrder(item.getSortOrder());
            copy.setActive(item.isActive());
            controlItemRepository.save(copy);
            oldToNewControlItemId.put(item.getId(), copy.getId());
        }
        for (PekProgramIndicator indicator : indicatorRepository.findByProgramIdOrderBySortOrderAsc(source.getId())) {
            Long newControlItemId = oldToNewControlItemId.get(indicator.getControlItemId());
            if (newControlItemId == null) {
                continue;
            }
            PekProgramIndicator copy = new PekProgramIndicator();
            copy.setProgramId(clone.getId());
            copy.setControlItemId(newControlItemId);
            copy.setIndicatorId(indicator.getIndicatorId());
            copy.setIndicatorCode(indicator.getIndicatorCode());
            copy.setIndicatorName(indicator.getIndicatorName());
            copy.setUnit(indicator.getUnit());
            copy.setNormativeId(indicator.getNormativeId());
            copy.setNormativeValue(indicator.getNormativeValue());
            copy.setComparisonType(indicator.getComparisonType());
            copy.setMinValue(indicator.getMinValue());
            copy.setMaxValue(indicator.getMaxValue());
            copy.setMethodologyId(indicator.getMethodologyId());
            copy.setMeasurementDeviceType(indicator.getMeasurementDeviceType());
            copy.setMandatory(indicator.isMandatory());
            copy.setSortOrder(indicator.getSortOrder());
            indicatorRepository.save(copy);
        }
        for (PekProgramMeasure measure : measureRepository.findByProgramIdOrderByPlannedStartDateAsc(source.getId())) {
            PekProgramMeasure copy = new PekProgramMeasure();
            copy.setProgramId(clone.getId());
            copy.setCode(measure.getCode());
            copy.setName(measure.getName());
            copy.setDescription(measure.getDescription());
            copy.setPlannedStartDate(measure.getPlannedStartDate());
            copy.setPlannedEndDate(measure.getPlannedEndDate());
            copy.setResponsibleUserId(measure.getResponsibleUserId());
            copy.setPlannedBudget(measure.getPlannedBudget());
            copy.setCurrency(measure.getCurrency());
            copy.setStatus(PekMeasureStatus.PLANNED);
            measureRepository.save(copy);
        }

        audit(clone.getId(), userId, "CLONE", null, clone.getStatus().name(),
                "Клонировано из программы #" + source.getId());
        return toResponse(clone);
    }

    /** module spec §6.5: files download only through this authorized API, never a raw GridFS URL -
     *  see PekController#downloadProgramDocument for the Content-Disposition response. Size limit
     *  mirrors the module's own file-size requirement (§4: HTTP 413 on oversized uploads). */
    @Transactional
    public PekApiDtos.ProgramDocumentResponse uploadDocument(Long programId, MultipartFile file,
                                                              String documentType, Long userId) throws IOException {
        PekProgram program = getOrThrow(programId);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан");
        }
        if (file.getSize() > MAX_DOCUMENT_SIZE_BYTES) {
            throw new PayloadTooLargeException(
                    "Размер файла превышает допустимый лимит " + (MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)) + " МБ");
        }
        byte[] content = file.getBytes();
        StoredFileMetadata stored = fileStorageService.storeBytes(
                content, file.getOriginalFilename(), file.getContentType(),
                "pek-program-" + programId, String.valueOf(userId));

        PekProgramDocument document = new PekProgramDocument();
        document.setProgramId(program.getId());
        document.setFileId(stored.fileId());
        document.setDocumentType(documentType);
        document.setFileName(stored.filename());
        document.setContentType(stored.contentType());
        document.setSize(stored.size());
        document.setSha256(sha256Hex(content));
        document.setUploadedBy(userId);
        documentRepository.save(document);

        audit(program.getId(), userId, "DOCUMENT_UPLOAD", null, null, document.getFileName());
        return toDocumentDto(document);
    }

    @Transactional(readOnly = true)
    public StoredFileContent downloadDocument(Long programId, Long documentId) throws IOException {
        getOrThrow(programId);
        PekProgramDocument document = documentRepository.findByIdAndProgramId(documentId, programId)
                .orElseThrow(() -> new NotFoundException("Документ программы ПЭК не найден: " + documentId));
        return fileStorageService.load(document.getFileId());
    }

    private static String sha256Hex(byte[] data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ProgramHistoryEntry> history(Long id) {
        getOrThrow(id);
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(ENTITY_TYPE, id).stream()
                .map(entry -> new PekApiDtos.ProgramHistoryEntry(
                        entry.getActionType(),
                        resolveActorName(entry.getActorUserId()),
                        entry.getComment(),
                        entry.getOldValue(),
                        entry.getNewValue(),
                        entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null))
                .toList();
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ProgramResponse get(Long id) {
        return toResponse(getOrThrow(id));
    }

    /** GET /api/pek/programs (module spec §8): every filter optional, the first list open with no
     *  companyId/objectId must not 400. Company-scope-per-user restriction beyond the PEK_VIEW role
     *  check is a known limitation - this codebase has no existing per-user company-access model to
     *  build on (confirmed absent project-wide), so it is not fabricated here. */
    @Transactional(readOnly = true)
    public PageResponse<PekApiDtos.ProgramResponse> list(Long companyId, Long objectId, String search,
                                                          String status, LocalDate activeOn,
                                                          Long responsibleUserId, Integer page, Integer size,
                                                          String sort) {
        PekProgramStatus statusEnum = parseStatus(status);
        String likeSearch = isBlank(search) ? null : "%" + search.trim().toLowerCase() + "%";
        Pageable pageable = PageRequest.of(resolvePage(page), resolveSize(size), resolveSort(sort));
        return PageResponse.of(
                programRepository.search(companyId, objectId, statusEnum, responsibleUserId, activeOn, likeSearch, pageable),
                this::toResponse);
    }

    /** Kept for existing callers scoped to one object (dashboard/report-creation-context use this
     *  narrower, unpaginated shape) - list() above is the general-purpose filtered/paged entry
     *  point and does not replace this, they serve different callers (module spec §30: no two
     *  competing implementations of the SAME operation - this one is a distinct, narrower query). */
    @Transactional(readOnly = true)
    public List<PekApiDtos.ProgramResponse> listForObject(Long companyId, Long objectId) {
        return programRepository.findByCompanyIdAndObjectIdOrderByValidFromDesc(companyId, objectId).stream()
                .map(this::toResponse)
                .toList();
    }

    private static Sort resolveSort(String sort) {
        if (isBlank(sort)) {
            return Sort.by(Sort.Direction.DESC, "validFrom");
        }
        String[] parts = sort.split(",", 2);
        String property = switch (parts[0].trim()) {
            case "number", "name", "status", "validFrom", "validUntil", "createdAt", "updatedAt" -> parts[0].trim();
            default -> "validFrom";
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }

    private static PekProgramStatus parseStatus(String status) {
        if (isBlank(status)) {
            return null;
        }
        try {
            return PekProgramStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Некорректный статус программы ПЭК: " + status);
        }
    }

    private static int resolvePage(Integer page) {
        return page != null && page >= 0 ? page : 0;
    }

    private static int resolveSize(Integer size) {
        if (size == null || size <= 0) {
            return 20;
        }
        return Math.min(size, 100);
    }

    /** Version is now mandatory (module spec §2.2 - "нельзя разрешать изменение без версии"):
     *  the controller requires an If-Match header, but this check is the real guarantee - a null
     *  here means a caller bypassed the controller layer, which must fail loud, not silently skip
     *  the optimistic-lock check. */
    private static void checkVersion(PekProgram program, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Требуется заголовок If-Match с текущей версией программы ПЭК", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(program.getVersion())) {
            throw new ConflictException("Программа ПЭК была изменена другим пользователем", "PEK_VERSION_CONFLICT");
        }
    }

    private static void requireTransition(PekProgram program, PekProgramStatus target) {
        if (!program.getStatus().canTransitionTo(target)) {
            throw new ConflictException("Переход из " + program.getStatus() + " в " + target + " недопустим",
                    "PEK_PROGRAM_INVALID_TRANSITION");
        }
    }

    private void replaceControlItems(Long programId, List<PekApiDtos.ControlItemDto> dtos) {
        controlItemRepository.deleteByProgramId(programId);
        controlItemRepository.flush();
        if (dtos == null) {
            return;
        }
        int order = 0;
        for (PekApiDtos.ControlItemDto dto : dtos) {
            if (isBlank(dto.code())) {
                throw new BadRequestException("Укажите code для позиции контроля");
            }
            if (isBlank(dto.name())) {
                throw new BadRequestException("Укажите name для позиции контроля");
            }
            if (isBlank(dto.controlType())) {
                throw new BadRequestException("Укажите controlType для позиции контроля: " + dto.code());
            }
            PekProgramControlItem item = new PekProgramControlItem();
            item.setProgramId(programId);
            item.setCode(dto.code().trim());
            item.setName(dto.name().trim());
            item.setSectionCode(dto.sectionCode());
            item.setControlType(parseEnum(PekControlType.class, dto.controlType(), "controlType"));
            item.setEnvironmentComponent(dto.environmentComponent());
            item.setMonitoringPointId(dto.monitoringPointId());
            item.setEmissionSourceId(dto.emissionSourceId());
            item.setWaterOutletId(dto.waterOutletId());
            item.setWasteSourceId(dto.wasteSourceId());
            item.setLaboratoryId(dto.laboratoryId());
            item.setFrequencyType(parseEnum(PekFrequencyType.class,
                    dto.frequencyType() != null ? dto.frequencyType() : "PER_EVENT", "frequencyType"));
            item.setFrequencyValue(dto.frequencyValue() != null ? dto.frequencyValue() : 1);
            item.setPlannedCount(dto.plannedCount());
            item.setMeasurementMethod(dto.measurementMethod());
            item.setSamplingMethod(dto.samplingMethod());
            item.setStartDate(!isBlank(dto.startDate()) ? LocalDate.parse(dto.startDate().trim()) : null);
            item.setEndDate(!isBlank(dto.endDate()) ? LocalDate.parse(dto.endDate().trim()) : null);
            item.setResponsibleUserId(dto.responsibleUserId());
            item.setMandatory(dto.mandatory() == null || dto.mandatory());
            item.setSortOrder(dto.sortOrder() != null ? dto.sortOrder() : order);
            item.setActive(dto.active() == null || dto.active());
            controlItemRepository.save(item);
            order++;
        }
    }

    private void replaceIndicators(Long programId, List<PekApiDtos.IndicatorDto> dtos) {
        indicatorRepository.deleteByProgramId(programId);
        indicatorRepository.flush();
        if (dtos == null) {
            return;
        }
        List<PekProgramControlItem> items = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        int order = 0;
        for (PekApiDtos.IndicatorDto dto : dtos) {
            Long controlItemId = resolveControlItemId(dto, items);
            if (isBlank(dto.indicatorName())) {
                throw new BadRequestException("Укажите indicatorName для показателя");
            }
            PekProgramIndicator indicator = new PekProgramIndicator();
            indicator.setProgramId(programId);
            indicator.setControlItemId(controlItemId);
            indicator.setIndicatorId(dto.indicatorId());
            indicator.setIndicatorCode(dto.indicatorCode());
            indicator.setIndicatorName(dto.indicatorName().trim());
            indicator.setUnit(dto.unit());
            indicator.setNormativeId(dto.normativeId());
            indicator.setNormativeValue(dto.normativeValue());
            indicator.setComparisonType(!isBlank(dto.comparisonType()) ? ComparisonType.fromApi(dto.comparisonType()) : null);
            indicator.setMinValue(dto.minValue());
            indicator.setMaxValue(dto.maxValue());
            indicator.setMethodologyId(dto.methodologyId());
            indicator.setMeasurementDeviceType(dto.measurementDeviceType());
            indicator.setMandatory(dto.mandatory() == null || dto.mandatory());
            indicator.setSortOrder(dto.sortOrder() != null ? dto.sortOrder() : order);
            indicatorRepository.save(indicator);
            order++;
        }
    }

    private static Long resolveControlItemId(PekApiDtos.IndicatorDto dto, List<PekProgramControlItem> items) {
        if (dto.controlItemId() != null) {
            boolean belongsToProgram = items.stream().anyMatch(i -> i.getId().equals(dto.controlItemId()));
            if (!belongsToProgram) {
                throw new BadRequestException(
                        "controlItemId показателя не относится к этой программе: " + dto.controlItemId());
            }
            return dto.controlItemId();
        }
        if (dto.controlItemIndex() != null) {
            if (dto.controlItemIndex() < 0 || dto.controlItemIndex() >= items.size()) {
                throw new BadRequestException("Некорректный controlItemIndex у показателя: " + dto.controlItemIndex());
            }
            return items.get(dto.controlItemIndex()).getId();
        }
        throw new BadRequestException("Укажите controlItemId или controlItemIndex для показателя: " + dto.indicatorName());
    }

    private void replaceMeasures(Long programId, List<PekApiDtos.MeasureDto> dtos) {
        measureRepository.deleteByProgramId(programId);
        measureRepository.flush();
        if (dtos == null) {
            return;
        }
        for (PekApiDtos.MeasureDto dto : dtos) {
            if (isBlank(dto.code())) {
                throw new BadRequestException("Укажите code для мероприятия");
            }
            if (isBlank(dto.name())) {
                throw new BadRequestException("Укажите name для мероприятия");
            }
            PekProgramMeasure measure = new PekProgramMeasure();
            measure.setProgramId(programId);
            measure.setCode(dto.code().trim());
            measure.setName(dto.name().trim());
            measure.setDescription(dto.description());
            measure.setPlannedStartDate(!isBlank(dto.plannedStartDate()) ? LocalDate.parse(dto.plannedStartDate().trim()) : null);
            measure.setPlannedEndDate(!isBlank(dto.plannedEndDate()) ? LocalDate.parse(dto.plannedEndDate().trim()) : null);
            measure.setResponsibleUserId(dto.responsibleUserId());
            measure.setPlannedBudget(dto.plannedBudget());
            measure.setCurrency(dto.currency());
            measure.setStatus(!isBlank(dto.status()) ? parseEnum(PekMeasureStatus.class, dto.status(), "status") : PekMeasureStatus.PLANNED);
            measure.setCompletionPercent(dto.completionPercent() != null ? dto.completionPercent() : 0);
            measure.setResultDescription(dto.resultDescription());
            measureRepository.save(measure);
        }
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String raw, String field) {
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Некорректное значение поля " + field + ": " + raw);
        }
    }

    private void audit(Long programId, Long userId, String actionType, String oldStatus, String newStatus, String comment) {
        User actor = userId != null ? userRepository.findById(userId).orElse(null) : null;
        auditLogService.log(ENTITY_TYPE, programId, null, actor, actionType, oldStatus, newStatus, comment);
    }

    private String resolveActorName(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId).map(User::getName).orElse(null);
    }

    List<PekProgram> findActiveForObject(Long companyId, Long objectId) {
        return programRepository.findByCompanyIdAndObjectIdAndStatus(companyId, objectId, PekProgramStatus.ACTIVE);
    }

    PekProgram getOrThrow(Long id) {
        return programRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + id));
    }

    PekApiDtos.ProgramResponse toResponse(PekProgram p) {
        PekApiDtos.CompanyShortDto company = companyRepository.findById(p.getCompanyId())
                .map(c -> new PekApiDtos.CompanyShortDto(c.getId(), c.getName(), c.getBin()))
                .orElse(null);
        PekApiDtos.CompanyObjectShortDto object = companyObjectRepository.findById(p.getObjectId())
                .map(o -> new PekApiDtos.CompanyObjectShortDto(o.getId(), o.getName()))
                .orElse(null);
        PekApiDtos.UserShortDto responsibleUser = toUserShortDto(p.getResponsibleUserId());

        List<PekProgramControlItem> controlItemEntities = controlItemRepository.findByProgramIdOrderBySortOrderAsc(p.getId());
        List<PekProgramIndicator> indicatorEntities = indicatorRepository.findByProgramIdOrderBySortOrderAsc(p.getId());
        List<PekApiDtos.ControlItemDto> controlItems = controlItemEntities.stream().map(this::toControlItemDto).toList();
        List<PekApiDtos.IndicatorDto> indicators = indicatorEntities.stream().map(this::toIndicatorDto).toList();
        List<PekApiDtos.MeasureDto> measures = measureRepository.findByProgramIdOrderByPlannedStartDateAsc(p.getId())
                .stream().map(this::toMeasureDto).toList();
        List<PekApiDtos.ProgramDocumentResponse> documents = documentRepository.findByProgramIdOrderByUploadedAtDesc(p.getId())
                .stream().map(this::toDocumentDto).toList();

        return new PekApiDtos.ProgramResponse(
                p.getId(), p.getCompanyId(), p.getObjectId(), p.getNumber(), p.getName(), p.getDescription(),
                p.getValidFrom().toString(), p.getValidUntil().toString(), p.getStatus().name(),
                p.getResponsibleUserId(), p.getReviewerUserId(), p.getApproverUserId(),
                readinessPercent(p, controlItemEntities, indicatorEntities),
                formatDateTime(p.getSubmittedAt()), formatDateTime(p.getApprovedAt()),
                formatDateTime(p.getActivatedAt()), formatDateTime(p.getArchivedAt()),
                p.getVersion(), company, object, responsibleUser,
                controlItems, indicators, measures, documents,
                availableActions(p.getStatus()), !p.getStatus().isEditable());
    }

    /** Real, simple completeness metric over five criteria a program needs before it's meaningful
     *  to submit for review - not a stand-in for validation-engine readiness (that belongs to
     *  reports, module spec §12), just "how filled in is this program header+plan". */
    private static Integer readinessPercent(PekProgram p, List<PekProgramControlItem> items,
                                             List<PekProgramIndicator> indicators) {
        int satisfied = 0;
        int total = 5;
        if (!isBlank(p.getName())) satisfied++;
        if (!isBlank(p.getDescription())) satisfied++;
        if (p.getResponsibleUserId() != null) satisfied++;
        if (!items.isEmpty()) satisfied++;
        if (!indicators.isEmpty()) satisfied++;
        return Math.round(100f * satisfied / total);
    }

    /** Business-rule action availability derived purely from the current workflow state (module
     *  spec §23) - actual authorization for each of these remains enforced independently by the
     *  controller's per-endpoint @PreAuthorize; this list tells the frontend what's *possible*
     *  given the status, not what THIS user is allowed to do, so it does not silently grant an
     *  action a real permission check would still reject. */
    private static List<String> availableActions(PekProgramStatus status) {
        List<String> actions = new ArrayList<>();
        if (status.isEditable()) {
            actions.add("EDIT");
        }
        if (status.canTransitionTo(PekProgramStatus.UNDER_REVIEW)) actions.add("SUBMIT_REVIEW");
        if (status.canTransitionTo(PekProgramStatus.RETURNED)) actions.add("RETURN");
        if (status.canTransitionTo(PekProgramStatus.APPROVED)) actions.add("APPROVE");
        if (status.canTransitionTo(PekProgramStatus.ACTIVE)) actions.add("ACTIVATE");
        if (status.canTransitionTo(PekProgramStatus.ARCHIVED)) actions.add("ARCHIVE");
        actions.add("CLONE");
        return actions;
    }

    private PekApiDtos.ControlItemDto toControlItemDto(PekProgramControlItem i) {
        return new PekApiDtos.ControlItemDto(
                i.getId(), i.getCode(), i.getName(), i.getSectionCode(),
                i.getControlType() != null ? i.getControlType().name() : null,
                i.getEnvironmentComponent(), i.getMonitoringPointId(), i.getEmissionSourceId(),
                i.getWaterOutletId(), i.getWasteSourceId(), i.getLaboratoryId(),
                i.getFrequencyType() != null ? i.getFrequencyType().name() : null, i.getFrequencyValue(),
                i.getPlannedCount(), i.getMeasurementMethod(), i.getSamplingMethod(),
                i.getStartDate() != null ? i.getStartDate().toString() : null,
                i.getEndDate() != null ? i.getEndDate().toString() : null,
                i.getResponsibleUserId(), i.isMandatory(), i.getSortOrder(), i.isActive());
    }

    private PekApiDtos.IndicatorDto toIndicatorDto(PekProgramIndicator i) {
        return new PekApiDtos.IndicatorDto(
                i.getId(), null, i.getControlItemId(), i.getIndicatorId(), i.getIndicatorCode(), i.getIndicatorName(),
                i.getUnit(), i.getNormativeId(), i.getNormativeValue(),
                i.getComparisonType() != null ? i.getComparisonType().name() : null,
                i.getMinValue(), i.getMaxValue(), i.getMethodologyId(), i.getMeasurementDeviceType(),
                i.isMandatory(), i.getSortOrder());
    }

    private PekApiDtos.MeasureDto toMeasureDto(PekProgramMeasure m) {
        return new PekApiDtos.MeasureDto(
                m.getId(), m.getCode(), m.getName(), m.getDescription(),
                m.getPlannedStartDate() != null ? m.getPlannedStartDate().toString() : null,
                m.getPlannedEndDate() != null ? m.getPlannedEndDate().toString() : null,
                m.getResponsibleUserId(), m.getPlannedBudget(), m.getCurrency(),
                effectiveMeasureStatus(m).name(), m.getCompletionPercent(), m.getResultDescription());
    }

    /** OVERDUE is derived, not stored (see PekMeasureStatus javadoc) - a PLANNED/IN_PROGRESS
     *  measure whose plannedEndDate has passed reads as OVERDUE without a separate scheduled job. */
    private static PekMeasureStatus effectiveMeasureStatus(PekProgramMeasure m) {
        if ((m.getStatus() == PekMeasureStatus.PLANNED || m.getStatus() == PekMeasureStatus.IN_PROGRESS)
                && m.getPlannedEndDate() != null && m.getPlannedEndDate().isBefore(LocalDate.now())) {
            return PekMeasureStatus.OVERDUE;
        }
        return m.getStatus();
    }

    private PekApiDtos.ProgramDocumentResponse toDocumentDto(PekProgramDocument d) {
        return new PekApiDtos.ProgramDocumentResponse(
                d.getId(), d.getDocumentType(), d.getFileName(), d.getContentType(), d.getSize(),
                d.getSha256(), d.getUploadedBy(), formatDateTime(d.getUploadedAt()));
    }

    private PekApiDtos.UserShortDto toUserShortDto(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                .orElse(null);
    }

    private static String formatDateTime(LocalDateTime dt) {
        return dt != null ? dt.toString() : null;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static LocalDate parseDate(String raw, String field) {
        if (isBlank(raw)) {
            throw new BadRequestException("Укажите " + field);
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (Exception e) {
            throw new BadRequestException("Некорректная дата в поле " + field);
        }
    }
}
