package kz.eco.pek;

import kz.eco.audit.AuditLogRepository;
import kz.eco.audit.AuditLogService;
import kz.eco.common.ApiFieldError;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.PayloadTooLargeException;
import kz.eco.common.exception.ValidationException;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final PekReportProtocolSourceRepository reportProtocolSourceRepository;
    private final PekReportPlanFactRowRepository planFactRowRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final PekAccessService accessService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final AuditLogRepository auditLogRepository;
    private final FileStorageService fileStorageService;
    private final PekSettingsService settingsService;
    private final PekProgramReadinessService readinessService;
    private final PekEnvironmentalPermitRepository permitRepository;
    private final PekProgramPermitLinkRepository programPermitLinkRepository;
    private final PekReportRepository reportRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;
    private final PekProgramInternalInspectionRepository internalInspectionRepository;
    private final PekProgramMeasurementQaRepository measurementQaRepository;
    private final PekProgramEmergencyProcedureRepository emergencyProcedureRepository;
    private final PekProgramResponsibilityRepository responsibilityRepository;
    private final PekRegulationVersionService regulationVersionService;

    private static final String ENTITY_TYPE = "PekProgram";
    private static final long MAX_DOCUMENT_SIZE_BYTES = 25L * 1024 * 1024;

    public PekProgramService(PekProgramRepository programRepository,
                             PekProgramControlItemRepository controlItemRepository,
                             PekProgramIndicatorRepository indicatorRepository,
                             PekProgramMeasureRepository measureRepository,
                             PekProgramDocumentRepository documentRepository,
                             PekReportProtocolSourceRepository reportProtocolSourceRepository,
                             PekReportPlanFactRowRepository planFactRowRepository,
                             CompanyRepository companyRepository,
                             CompanyObjectRepository companyObjectRepository,
                             PekAccessService accessService,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             AuditLogRepository auditLogRepository,
                             FileStorageService fileStorageService, PekSettingsService settingsService,
                             PekProgramReadinessService readinessService,
                             PekEnvironmentalPermitRepository permitRepository,
                             PekProgramPermitLinkRepository programPermitLinkRepository,
                             PekReportRepository reportRepository,
                             PekProgramMonitoringRepository monitoringRepository,
                             PekMonitoringPointRepository monitoringPointRepository,
                             PekProgramInternalInspectionRepository internalInspectionRepository,
                             PekProgramMeasurementQaRepository measurementQaRepository,
                             PekProgramEmergencyProcedureRepository emergencyProcedureRepository,
                             PekProgramResponsibilityRepository responsibilityRepository,
                             PekRegulationVersionService regulationVersionService) {
        this.programRepository = programRepository;
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.measureRepository = measureRepository;
        this.documentRepository = documentRepository;
        this.reportProtocolSourceRepository = reportProtocolSourceRepository;
        this.planFactRowRepository = planFactRowRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.accessService = accessService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.auditLogRepository = auditLogRepository;
        this.fileStorageService = fileStorageService;
        this.settingsService = settingsService;
        this.readinessService = readinessService;
        this.permitRepository = permitRepository;
        this.programPermitLinkRepository = programPermitLinkRepository;
        this.reportRepository = reportRepository;
        this.monitoringRepository = monitoringRepository;
        this.monitoringPointRepository = monitoringPointRepository;
        this.internalInspectionRepository = internalInspectionRepository;
        this.measurementQaRepository = measurementQaRepository;
        this.emergencyProcedureRepository = emergencyProcedureRepository;
        this.responsibilityRepository = responsibilityRepository;
        this.regulationVersionService = regulationVersionService;
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
        // виртуальные объекты на основании companyId"). Centralized in PekAccessService (Task 5) -
        // this used to be its own inline copy of the same check PekReportService also had.
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new NotFoundException("Компания не найдена"));
        CompanyObject object = accessService.requireObjectBelongsToCompany(company.getId(), request.objectId());
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
        program.setResponsibleUserId(request.responsibleUserId() != null ? request.responsibleUserId()
                : settingsService.defaultResponsibleUserId(company.getId()));
        program.setStatus(PekProgramStatus.DRAFT);
        program.setCreatedBy(userId);
        stampCurrentRegulation(program);
        applyFacilitySnapshot(program, request.facilitySnapshot());
        programRepository.saveAndFlush(program);

        replaceControlItems(program.getId(), request.controlItems());
        replaceIndicators(program.getId(), request.indicators());
        replaceMeasures(program.getId(), request.measures());
        replacePermitLinks(program.getId(), program.getCompanyId(), program.getObjectId(), request.permitIds());

        audit(program.getId(), userId, "CREATE", null, null, "Программа ПЭК создана");
        return toResponse(program);
    }

    /**
     * Stamps a brand-new program with the regulation edition in force today, read from the
     * reference book rather than from a compiled-in constant. Applied ONLY on create/clone: an
     * existing program keeps the edition it was authored under for life, so that an amendment
     * published later never silently changes what an approved program claims to comply with.
     */
    private void stampCurrentRegulation(PekProgram program) {
        PekRegulationVersion edition = regulationVersionService.current();
        program.setRegulationCode(edition.code());
        program.setRegulationVersion(edition.citation());
        program.setTemplateVersion(edition.programTemplateVersion());
    }

    /** Full or partial aggregate replace (module spec §8: "не должны теряться"). Any collection
     *  argument left null means "leave that part of the aggregate untouched" - only an explicit
     *  empty list clears it. Only legal while the program {@link PekProgramStatus#isEditable()}. */
    @Transactional
    public PekApiDtos.ProgramResponse edit(Long id, PekApiDtos.EditProgramRequest request, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyEditPermission(userId, actorRole(userId), program.getCompanyId());
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
        // Module fix item 4: edit() is the entry point for control items/indicators/measures too
        // (below) - any content change here counts as a child-section change.
        program.setContentRevision(program.getContentRevision() + 1);
        // The snapshot must be applied BEFORE the flush. It used to be applied after, and was then
        // written by dirty-checking at commit - a second flush that bumped @Version a second time.
        // toResponse() below reports the version from the first flush, so the client's next
        // If-Match was already one behind the row and every following autosave got a 409, which is
        // what made edits "disappear" for the user. One mutation, one flush, one version bump.
        if (request.facilitySnapshot() != null) {
            applyFacilitySnapshot(program, request.facilitySnapshot());
        }
        programRepository.saveAndFlush(program);

        if (request.controlItems() != null) {
            replaceControlItems(program.getId(), request.controlItems());
        }
        if (request.indicators() != null) {
            replaceIndicators(program.getId(), request.indicators());
        }
        if (request.measures() != null) {
            replaceMeasures(program.getId(), request.measures());
        }
        if (request.permitIds() != null) {
            replacePermitLinks(program.getId(), program.getCompanyId(), program.getObjectId(), request.permitIds());
        }

        audit(program.getId(), userId, "UPDATE", oldStatus, program.getStatus().name(), "Программа ПЭК изменена");
        return toResponse(program);
    }

    /** Only a DRAFT program may be deleted (module spec: nothing has been submitted for review yet,
     *  so there is no downstream state to preserve) - any other status is a 409, same as an invalid
     *  transition, not a 403 (the actor may well have EDIT rights, the status just forbids it). */
    @Transactional
    public void delete(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyEditPermission(userId, actorRole(userId), program.getCompanyId());
        if (program.getStatus() != PekProgramStatus.DRAFT) {
            throw new ConflictException(
                    "Программу ПЭК в статусе " + program.getStatus() + " нельзя удалить",
                    "PEK_PROGRAM_NOT_DELETABLE");
        }
        Long programId = program.getId();
        if (!reportRepository.findByProgramId(programId).isEmpty()) {
            throw new ConflictException(
                    "У программы ПЭК есть отчёты - удаление невозможно", "PEK_PROGRAM_HAS_REPORTS");
        }
        monitoringPointRepository.deleteByProgramId(programId);
        monitoringRepository.deleteByProgramId(programId);
        internalInspectionRepository.deleteByProgramId(programId);
        measurementQaRepository.deleteByProgramId(programId);
        emergencyProcedureRepository.deleteByProgramId(programId);
        responsibilityRepository.deleteByProgramId(programId);
        indicatorRepository.deleteByProgramId(programId);
        controlItemRepository.deleteByProgramId(programId);
        measureRepository.deleteByProgramId(programId);
        programPermitLinkRepository.deleteByProgramId(programId);
        documentRepository.deleteAll(documentRepository.findByProgramIdOrderByUploadedAtDesc(programId));
        programRepository.delete(program);
        audit(programId, userId, "DELETE", program.getStatus().name(), null, "Программа ПЭК удалена");
    }

    @Transactional
    public PekApiDtos.ProgramResponse submitReview(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyEditPermission(userId, actorRole(userId), program.getCompanyId());
        requireTransition(program, PekProgramStatus.UNDER_REVIEW);
        if (controlItemRepository.countByProgramId(program.getId()) == 0) {
            throw new BadRequestException(
                    "Нельзя отправить на проверку программу без позиций контроля", "PEK_PROGRAM_EMPTY");
        }
        requireReady(program);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.UNDER_REVIEW);
        program.setSubmittedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.saveAndFlush(program);
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
        accessService.requireCompanyReviewPermission(userId, actorRole(userId), program.getCompanyId());
        requireTransition(program, PekProgramStatus.RETURNED);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.RETURNED);
        program.setReviewerUserId(userId);
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.saveAndFlush(program);
        audit(program.getId(), userId, "RETURN", oldStatus, program.getStatus().name(), reason);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse approve(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyReviewPermission(userId, actorRole(userId), program.getCompanyId());
        requireTransition(program, PekProgramStatus.APPROVED);
        requireNotSelfApproval(program.getCreatedBy(), userId);
        requireReady(program);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.APPROVED);
        program.setApproverUserId(userId);
        program.setApprovedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.saveAndFlush(program);
        audit(program.getId(), userId, "APPROVE", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse activate(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyReviewPermission(userId, actorRole(userId), program.getCompanyId());
        requireTransition(program, PekProgramStatus.ACTIVE);
        requireReady(program);
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
        programRepository.saveAndFlush(program);
        audit(program.getId(), userId, "ACTIVATE", oldStatus, program.getStatus().name(), null);
        return toResponse(program);
    }

    @Transactional
    public PekApiDtos.ProgramResponse archive(Long id, Long version, Long userId) {
        PekProgram program = getOrThrow(id);
        checkVersion(program, version);
        accessService.requireCompanyReviewPermission(userId, actorRole(userId), program.getCompanyId());
        requireTransition(program, PekProgramStatus.ARCHIVED);
        String oldStatus = program.getStatus().name();
        program.setStatus(PekProgramStatus.ARCHIVED);
        program.setArchivedAt(LocalDateTime.now());
        program.setUpdatedAt(LocalDateTime.now());
        programRepository.saveAndFlush(program);
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
        // A clone is a NEW draft, so it is stamped with the edition in force today - not with the
        // (possibly superseded) edition the source program was approved under.
        stampCurrentRegulation(clone);
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
        // Module fix: uploadDocument previously never checked isEditable() at all - a document
        // could be attached to an APPROVED/ACTIVE/ARCHIVED (read-only) program despite edit()
        // already enforcing this same rule for every other field on the aggregate. Frontend
        // hiding the upload button is not a substitute for this.
        if (!program.getStatus().isEditable()) {
            throw new ConflictException(
                    "Программу ПЭК в статусе " + program.getStatus() + " нельзя редактировать",
                    "PEK_PROGRAM_NOT_EDITABLE");
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан");
        }
        if (file.getSize() > MAX_DOCUMENT_SIZE_BYTES) {
            throw new PayloadTooLargeException(
                    "Размер файла превышает допустимый лимит " + (MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)) + " МБ");
        }
        byte[] content = file.getBytes();
        PekProgramDocumentFileValidator.validate(file.getOriginalFilename(), file.getContentType(), content);
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

        // Module fix item 4: a document upload is a child-section change too.
        program.setContentRevision(program.getContentRevision() + 1);
        programRepository.saveAndFlush(program);

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
    /** @param companyIds tenant scope for a non-global caller (null = unrestricted, i.e. the
     *  caller has global access) - see PekAccessService#resolveAccessibleCompanyIds. Applied at
     *  the SQL level via PekProgramRepository#search, never filtered in Java. */
    @Transactional(readOnly = true)
    public PageResponse<PekApiDtos.ProgramResponse> list(Long companyId, Long objectId, String search,
                                                          String status, LocalDate activeOn,
                                                          Long responsibleUserId, Integer page, Integer size,
                                                          String sort, java.util.Collection<Long> companyIds) {
        PekProgramStatus statusEnum = parseStatus(status);
        String likeSearch = isBlank(search) ? null : "%" + search.trim().toLowerCase() + "%";
        Pageable pageable = PageRequest.of(resolvePage(page), resolveSize(size), resolveSort(sort));
        List<Long> scopeList = companyIds == null ? null : List.copyOf(companyIds);
        return PageResponse.of(
                programRepository.search(companyId, objectId, statusEnum, responsibleUserId, activeOn, likeSearch, scopeList, pageable),
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
    /** PekProgramService's workflow methods receive an explicit userId param (not CurrentUser
     *  internally) - this resolves the acting user's global role for the membership-role checks in
     *  {@link PekAccessService}, same actor the caller already authenticated as. */
    private kz.eco.user.UserRole actorRole(Long userId) {
        return userRepository.findById(userId)
                .map(User::getRole)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + userId));
    }

    private static void checkVersion(PekProgram program, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Требуется заголовок If-Match с текущей версией программы ПЭК", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(program.getVersion())) {
            throw ConflictException.versionConflict("Программа ПЭК была изменена другим пользователем", "PEK_VERSION_CONFLICT", program.getVersion());
        }
    }

    private static void requireTransition(PekProgram program, PekProgramStatus target) {
        if (!program.getStatus().canTransitionTo(target)) {
            throw new ConflictException("Переход из " + program.getStatus() + " в " + target + " недопустим",
                    "PEK_PROGRAM_INVALID_TRANSITION");
        }
    }

    /** Public readiness view (module fix item 4: "backend readiness") - same evaluator
     *  submitReview/approve/activate gate on internally, now directly inspectable by the frontend
     *  instead of only being discoverable by attempting a transition and getting 409. */
    @Transactional(readOnly = true)
    public PekApiDtos.ReadinessResponse readiness(Long id) {
        return readinessService.evaluate(getOrThrow(id));
    }

    /** Module fix item 7: single readiness gate shared by submitReview/approve/activate - a
     *  program with any blocking readiness issue (see PekProgramReadinessService) must never leave
     *  DRAFT, be approved, or be activated. Structured as code + errors (module spec), mirroring
     *  the existing PEK_REPORT_NOT_READY convention in PekReportService. */
    private void requireReady(PekProgram program) {
        PekApiDtos.ReadinessResponse readiness = readinessService.evaluate(program);
        if (!readiness.ready()) {
            throw new ConflictException(
                    "Программа не готова: " + readiness.blockingIssues().get(0).message(), "PEK_PROGRAM_NOT_READY");
        }
    }

    /** Maker-checker (module fix): the program's creator must not be the same person who approves
     *  it - only APPROVE requires this independent-review separation (not submit/return/activate/
     *  archive/clone). Checked in the service so a direct API call can't bypass it. */
    private static void requireNotSelfApproval(Long createdBy, Long actorId) {
        if (createdBy != null && createdBy.equals(actorId)) {
            throw new ConflictException(
                    "Автор программы не может самостоятельно утвердить её - требуется независимое согласование",
                    "PEK_MAKER_CHECKER_VIOLATION");
        }
    }

    /**
     * ID-preserving reconciliation (module spec §4): a program's control items are referenced by
     * ID from outside the aggregate once a report has run collection against it
     * (PekReportProtocolSource.controlItemId, and PekProgramIndicator.controlItemId within this
     * same aggregate) - the previous delete-all-then-reinsert approach silently orphaned every one
     * of those references on every edit, since every row got a brand new identity. Rows present in
     * the incoming list with a null id are created; rows with a non-null id belonging to this
     * program are updated in place (same identity, same FK target); existing rows whose id is not
     * present in the incoming list are deleted - the same identity-diffing rule for indicators and
     * measures below.
     */
    private void replaceControlItems(Long programId, List<PekApiDtos.ControlItemDto> dtos) {
        if (dtos == null) {
            return;
        }
        List<PekProgramControlItem> existing = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        Map<Long, PekProgramControlItem> byId = existing.stream()
                .collect(Collectors.toMap(PekProgramControlItem::getId, e -> e));
        Set<Long> keepIds = new HashSet<>();
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
            // Task 6: plannedCount is a human-entered override of the calculated frequency (see
            // PekFrequencyCalculator's javadoc - "an explicit plannedCount always wins") - a
            // negative one would make plannedOccurrences() and every plan/fact percentage
            // downstream of it nonsensical.
            if (dto.plannedCount() != null && dto.plannedCount() < 0) {
                throw new ValidationException("Некорректное значение plannedCount",
                        List.of(new ApiFieldError("controlItems[" + order + "].plannedCount",
                                "PEK_INVALID_PLANNED_COUNT", "plannedCount не может быть отрицательным")));
            }
            // frequencyValue is meaningless for PER_EVENT (plannedOccurrences() ignores it there,
            // module spec: event-driven items have no calendar-derivable count) - for every other
            // frequencyType it's the actual multiplier plannedOccurrences() divides the period by,
            // so zero/negative would silently corrupt that calculation instead of failing loud.
            PekFrequencyType requestedFrequencyType = !isBlank(dto.frequencyType())
                    ? parseEnum(PekFrequencyType.class, dto.frequencyType(), "frequencyType") : PekFrequencyType.PER_EVENT;
            if (requestedFrequencyType != PekFrequencyType.PER_EVENT
                    && dto.frequencyValue() != null && dto.frequencyValue() <= 0) {
                throw new ValidationException("Некорректное значение frequencyValue",
                        List.of(new ApiFieldError("controlItems[" + order + "].frequencyValue",
                                "PEK_INVALID_FREQUENCY_VALUE",
                                "frequencyValue должен быть положительным при frequencyType=" + requestedFrequencyType)));
            }
            PekProgramControlItem item;
            if (dto.id() != null) {
                item = byId.get(dto.id());
                if (item == null) {
                    throw new BadRequestException(
                            "controlItemId не принадлежит этой программе: " + dto.id(), "PEK_FOREIGN_CHILD_ID");
                }
                keepIds.add(item.getId());
            } else {
                item = new PekProgramControlItem();
                item.setProgramId(programId);
            }
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
        List<PekProgramControlItem> removed = existing.stream()
                .filter(e -> !keepIds.contains(e.getId()))
                .toList();
        for (PekProgramControlItem item : removed) {
            if (reportProtocolSourceRepository.existsByControlItemId(item.getId())) {
                throw new ConflictException(
                        "Позицию контроля \"" + item.getName() + "\" нельзя удалить: по ней уже собраны "
                                + "протоколы в отчёте ПЭК. Создайте новую версию программы вместо удаления.",
                        "PEK_CONTROL_ITEM_IN_USE");
            }
        }
        if (!removed.isEmpty()) {
            controlItemRepository.deleteAll(removed);
            controlItemRepository.flush();
        }
    }

    private void replaceIndicators(Long programId, List<PekApiDtos.IndicatorDto> dtos) {
        if (dtos == null) {
            return;
        }
        List<PekProgramControlItem> items = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        List<PekProgramIndicator> existing = indicatorRepository.findByProgramIdOrderBySortOrderAsc(programId);
        Map<Long, PekProgramIndicator> byId = existing.stream()
                .collect(Collectors.toMap(PekProgramIndicator::getId, e -> e));
        Set<Long> keepIds = new HashSet<>();
        int order = 0;
        for (PekApiDtos.IndicatorDto dto : dtos) {
            Long controlItemId = resolveControlItemId(dto, items);
            if (isBlank(dto.indicatorName())) {
                throw new BadRequestException("Укажите indicatorName для показателя");
            }
            // Task 6: a comparisonType with no value to compare against would make
            // PekPlanFactService#exceedanceRatio silently return "no violation" forever regardless
            // of the real measurement (LESS_OR_EQUAL/GREATER_OR_EQUAL/EQUAL all early-return empty
            // when normativeValue is null; RANGE/BETWEEN does the same for a null min AND max) -
            // rejecting the missing value here, at data-entry time, is the only place this can be
            // caught before it silently degrades exceedance detection into a no-op.
            ComparisonType parsedComparisonType = !isBlank(dto.comparisonType()) ? ComparisonType.fromApi(dto.comparisonType()) : null;
            if (parsedComparisonType != null) {
                switch (parsedComparisonType) {
                    case LESS_OR_EQUAL, GREATER_OR_EQUAL, EQUAL -> {
                        if (dto.normativeValue() == null) {
                            throw new ValidationException("Не указано нормативное значение",
                                    List.of(new ApiFieldError("indicators[" + order + "].normativeValue",
                                            "PEK_INDICATOR_NORMATIVE_REQUIRED",
                                            "normativeValue обязателен при comparisonType=" + parsedComparisonType)));
                        }
                    }
                    case RANGE, BETWEEN -> {
                        if (dto.minValue() == null && dto.maxValue() == null) {
                            throw new ValidationException("Не указан диапазон значений",
                                    List.of(new ApiFieldError("indicators[" + order + "].minValue",
                                            "PEK_INDICATOR_RANGE_REQUIRED",
                                            "minValue и/или maxValue обязательны при comparisonType=RANGE")));
                        }
                        if (dto.minValue() != null && dto.maxValue() != null && dto.minValue().compareTo(dto.maxValue()) > 0) {
                            throw new ValidationException("Некорректный диапазон значений",
                                    List.of(new ApiFieldError("indicators[" + order + "].minValue",
                                            "PEK_INDICATOR_RANGE_INVALID", "minValue не может быть больше maxValue")));
                        }
                    }
                    case ABSENT, INFO -> {
                        // No numeric value required - ABSENT means "any positive value violates",
                        // INFO carries no normative at all (module spec: informational indicators).
                    }
                }
            }
            PekProgramIndicator indicator;
            if (dto.id() != null) {
                indicator = byId.get(dto.id());
                if (indicator == null) {
                    throw new BadRequestException(
                            "indicatorId не принадлежит этой программе: " + dto.id(), "PEK_FOREIGN_CHILD_ID");
                }
                keepIds.add(indicator.getId());
            } else {
                indicator = new PekProgramIndicator();
                indicator.setProgramId(programId);
            }
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
        List<PekProgramIndicator> removed = existing.stream()
                .filter(e -> !keepIds.contains(e.getId()))
                .toList();
        for (PekProgramIndicator indicator : removed) {
            // Task 6: same FK-violation-avoidance guard as replaceControlItems' PEK_CONTROL_ITEM_IN_USE
            // check - an indicator with real matched results or computed plan/fact rows must not be
            // physically deletable (fk_pek_sources_indicator / fk_pek_plan_fact_indicator, V59).
            if (reportProtocolSourceRepository.existsByProgramIndicatorId(indicator.getId())
                    || planFactRowRepository.existsByProgramIndicatorId(indicator.getId())) {
                throw new ConflictException(
                        "Показатель \"" + indicator.getIndicatorName() + "\" нельзя удалить: по нему уже есть "
                                + "собранные результаты или рассчитанный план/факт в отчёте ПЭК. Создайте новую версию программы вместо удаления.",
                        "PEK_INDICATOR_IN_USE");
            }
        }
        if (!removed.isEmpty()) {
            indicatorRepository.deleteAll(removed);
            indicatorRepository.flush();
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
        if (dtos == null) {
            return;
        }
        List<PekProgramMeasure> existing = measureRepository.findByProgramIdOrderByPlannedStartDateAsc(programId);
        Map<Long, PekProgramMeasure> byId = existing.stream()
                .collect(Collectors.toMap(PekProgramMeasure::getId, e -> e));
        Set<Long> keepIds = new HashSet<>();
        for (PekApiDtos.MeasureDto dto : dtos) {
            if (isBlank(dto.code())) {
                throw new BadRequestException("Укажите code для мероприятия");
            }
            if (isBlank(dto.name())) {
                throw new BadRequestException("Укажите name для мероприятия");
            }
            PekProgramMeasure measure;
            if (dto.id() != null) {
                measure = byId.get(dto.id());
                if (measure == null) {
                    throw new BadRequestException(
                            "measureId не принадлежит этой программе: " + dto.id(), "PEK_FOREIGN_CHILD_ID");
                }
                keepIds.add(measure.getId());
            } else {
                measure = new PekProgramMeasure();
                measure.setProgramId(programId);
            }
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
        List<PekProgramMeasure> removed = existing.stream()
                .filter(e -> !keepIds.contains(e.getId()))
                .toList();
        if (!removed.isEmpty()) {
            measureRepository.deleteAll(removed);
            measureRepository.flush();
        }
    }

    /** Applies facility snapshot fields from the DTO onto the program entity (item 1 / V109).
     *  Null DTO = no-op (PATCH semantics: "leave untouched"). Individual null fields inside a
     *  non-null snapshot DTO clear the corresponding column (explicit null = user cleared the field). */
    private static void applyFacilitySnapshot(PekProgram program, PekApiDtos.FacilitySnapshotDto snap) {
        if (snap == null) return;
        program.setFacilityInformation(snap.facilityInformation());
        program.setKato(snap.kato());
        program.setBinSnapshot(snap.binSnapshot());
        program.setOked(snap.oked());
        program.setEnvironmentalCategory(snap.environmentalCategory());
        program.setDesignCapacity(snap.designCapacity());
        program.setProductionCharacteristics(snap.productionCharacteristics());
        program.setActualCapacity(snap.actualCapacity());
        program.setMonitoringScope(snap.monitoringScope());
        program.setReadinessNotes(snap.readinessNotes());
    }

    /** Replaces the set of environmental permits linked to the program (item 10 / V109).
     *  Each permitId is validated to belong to the same companyId + objectId before linking. */
    private void replacePermitLinks(Long programId, Long companyId, Long objectId, List<Long> permitIds) {
        if (permitIds == null) return;
        programPermitLinkRepository.deleteByProgramId(programId);
        programPermitLinkRepository.flush();
        for (Long permitId : permitIds) {
            PekEnvironmentalPermit permit = permitRepository.findById(permitId)
                    .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Разрешение не найдено: " + permitId));
            if (!companyId.equals(permit.getCompanyId())) {
                throw new kz.eco.common.exception.BadRequestException(
                        "Разрешение " + permitId + " принадлежит другой компании", "PEK_PERMIT_WRONG_COMPANY");
            }
            if (!objectId.equals(permit.getObjectId())) {
                throw new kz.eco.common.exception.BadRequestException(
                        "Разрешение " + permitId + " принадлежит другому объекту", "PEK_PERMIT_WRONG_OBJECT");
            }
            programPermitLinkRepository.save(new PekProgramPermitLink(programId, permitId));
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

    /** Shared period-coverage rule (Task 2): a report's [periodStart, periodEnd] window must fall
     *  entirely inside the program's [validFrom, validUntil] window - a program active only for Q1
     *  must not silently "cover" a Q3 report just because it happened to be the object's one ACTIVE
     *  program at creation time. Used by PekReportService (creation-context blocker + create()
     *  hard validation) AND PekReportCollectionService (defense in depth: re-checked before every
     *  collect(), since a program's validFrom/validUntil could change between report creation and
     *  a later collect() run - not duplicated business logic in two places, both callers delegate
     *  here). */
    boolean coversPeriod(PekProgram program, LocalDate periodStart, LocalDate periodEnd) {
        return !program.getValidFrom().isAfter(periodStart) && !program.getValidUntil().isBefore(periodEnd);
    }

    PekProgram getOrThrow(Long id) {
        return programRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + id));
    }

    PekApiDtos.ProgramResponse toResponse(PekProgram p) {
        return toResponse(p, null);
    }

    /** Used by PekProgramMonitoringService so its create/update/delete responses carry the
     *  up-to-date monitoring list alongside version/contentRevision/readiness/availableActions,
     *  without the frontend needing a second GET .../monitoring round-trip. */
    PekApiDtos.ProgramResponse toResponse(PekProgram p, kz.eco.pek.dto.PekMonitoringDtos.ListResponse monitoring) {
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

        List<Long> linkedPermitIds = programPermitLinkRepository.findByProgramId(p.getId())
                .stream().map(PekProgramPermitLink::getPermitId).toList();
        List<PekApiDtos.PermitShortDto> permits = linkedPermitIds.isEmpty()
                ? List.of()
                : permitRepository.findAllById(linkedPermitIds).stream()
                        .map(perm -> new PekApiDtos.PermitShortDto(perm.getId(), perm.getType(), perm.getNumber(),
                                perm.getAuthority(),
                                perm.getValidFrom() != null ? perm.getValidFrom().toString() : null,
                                perm.getValidTo() != null ? perm.getValidTo().toString() : null,
                                perm.getStatus() != null ? perm.getStatus().name() : null))
                        .toList();

        PekApiDtos.FacilitySnapshotDto facilitySnapshot = new PekApiDtos.FacilitySnapshotDto(
                p.getFacilityInformation(), p.getKato(), p.getBinSnapshot(), p.getOked(),
                p.getEnvironmentalCategory(), p.getDesignCapacity(), p.getProductionCharacteristics(),
                p.getActualCapacity(), p.getMonitoringScope(), p.getReadinessNotes());

        return new PekApiDtos.ProgramResponse(
                p.getId(), p.getCompanyId(), p.getObjectId(), p.getNumber(), p.getName(), p.getDescription(),
                p.getValidFrom().toString(), p.getValidUntil().toString(), p.getStatus().name(),
                p.getResponsibleUserId(), p.getReviewerUserId(), p.getApproverUserId(),
                readinessPercent(p, controlItemEntities, indicatorEntities),
                formatDateTime(p.getSubmittedAt()), formatDateTime(p.getApprovedAt()),
                formatDateTime(p.getActivatedAt()), formatDateTime(p.getArchivedAt()),
                p.getVersion(), company, object, responsibleUser,
                controlItems, indicators, measures, documents,
                availableActions(p), !p.getStatus().isEditable(),
                p.getRegulationVersion(), p.getRegulationCode(), p.getTemplateVersion(), p.getContentRevision(),
                facilitySnapshot, permits, monitoring);
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

    /** Module fix item 1: action availability computed from status + actor role/membership
     *  permissions + business rules together, not status alone - the backend is the single source
     *  of truth (mirrors PekReportService#availableActions' pattern). Must never say true for an
     *  action the real endpoint would then reject: edit/submit/clone/uploadDocument require the
     *  company-scoped EDIT membership tier; returnForRevision/approve/activate/archive require the
     *  REVIEW tier; approve is additionally denied to the program's own creator (maker-checker,
     *  item 8); submit/approve/activate are additionally gated on readiness (item 7) so the client
     *  never sees an action enabled that PEK_PROGRAM_NOT_READY would then reject a moment later. */
    private java.util.Map<String, Boolean> availableActions(PekProgram program) {
        User user = kz.eco.auth.CurrentUser.getOrNull();
        var role = user == null ? null : user.getRole();
        Long userId = user == null ? null : user.getId();
        boolean canEdit = userId != null && accessService.hasCompanyEditPermission(userId, role, program.getCompanyId());
        boolean canReview = userId != null && accessService.hasCompanyReviewPermission(userId, role, program.getCompanyId());
        boolean isCreator = userId != null && userId.equals(program.getCreatedBy());
        PekProgramStatus status = program.getStatus();
        boolean ready = readinessService.evaluate(program).ready();

        java.util.Map<String, Boolean> actions = new java.util.LinkedHashMap<>();
        actions.put("edit", canEdit && status.isEditable());
        actions.put("submit", canEdit && status.canTransitionTo(PekProgramStatus.UNDER_REVIEW) && ready);
        actions.put("returnForRevision", canReview && status.canTransitionTo(PekProgramStatus.RETURNED));
        actions.put("approve", canReview && !isCreator && status.canTransitionTo(PekProgramStatus.APPROVED) && ready);
        actions.put("activate", canReview && status.canTransitionTo(PekProgramStatus.ACTIVE) && ready);
        actions.put("archive", canReview && status.canTransitionTo(PekProgramStatus.ARCHIVED));
        actions.put("clone", canEdit);
        actions.put("uploadDocument", canEdit && status.isEditable());
        actions.put("delete", canEdit && status == PekProgramStatus.DRAFT);
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
