package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.PayloadTooLargeException;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Corrective-action workflow for {@link PekReportExceedance} (Iteration 2 of the PEK module
 * overhaul) - assign a responsible person, attach evidence, and transition status through
 * {@link PekExceedanceStatus#canTransitionTo}. Creation/idempotent recompute of exceedance rows
 * themselves stays in {@link PekPlanFactService#reconcileExceedances} (never duplicated here) -
 * this service only ever mutates the workflow fields of an existing row.
 */
@Service
public class PekExceedanceService {

    private static final Set<UserRole> REVIEWER_ROLES = Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);

    /** Roles that may act on a PEK report at all (corrective actions included) - mirrors
     *  PekSecurityExpressions.PEK_REPORT_EDIT's role set. Assigning "responsible" to a role outside
     *  this set (e.g. ACCOUNTANT) would produce a user who can never actually see or resolve the
     *  exceedance they've been assigned. */
    private static final Set<UserRole> ELIGIBLE_ASSIGNEE_ROLES = Set.of(
            UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST, UserRole.LABORATORY);

    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekExceedanceEvidenceFileRepository evidenceRepository;
    private final PekReportRepository reportRepository;
    private final UserRepository userRepository;
    private final PekAccessService accessService;
    private final PekStaffAssignmentRepository membershipRepository;
    private final FileStorageService fileStorageService;
    private final PekEvidenceFileAccessService evidenceFileAccessService;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekExceedanceCorrectiveActionRepository correctiveActionRepository;
    private final kz.eco.audit.AuditLogService auditLogService;

    private static final long MAX_EVIDENCE_FILE_SIZE_BYTES = 25L * 1024 * 1024;
    private static final String CORRECTIVE_ACTION_ENTITY_TYPE = "PekExceedanceCorrectiveAction";

    public PekExceedanceService(PekReportExceedanceRepository exceedanceRepository,
                                 PekExceedanceEvidenceFileRepository evidenceRepository,
                                 PekReportRepository reportRepository, UserRepository userRepository,
                                 PekAccessService accessService,
                                 PekStaffAssignmentRepository membershipRepository,
                                 FileStorageService fileStorageService,
                                 PekEvidenceFileAccessService evidenceFileAccessService,
                                 PekReportContentRevisionService contentRevisionService,
                                 PekExceedanceCorrectiveActionRepository correctiveActionRepository,
                                 kz.eco.audit.AuditLogService auditLogService) {
        this.exceedanceRepository = exceedanceRepository;
        this.evidenceRepository = evidenceRepository;
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
        this.membershipRepository = membershipRepository;
        this.fileStorageService = fileStorageService;
        this.evidenceFileAccessService = evidenceFileAccessService;
        this.contentRevisionService = contentRevisionService;
        this.correctiveActionRepository = correctiveActionRepository;
        this.auditLogService = auditLogService;
    }

    /** Evidence-file upload step (module fix item 6): mints a fileId tagged with this exact
     *  exceedance's storage context, so attachEvidence() can later verify the fileId it's given
     *  was actually uploaded here rather than trusting an arbitrary client-supplied value. Role/
     *  status checks mirror attachEvidence()'s own (see buildAvailableActions "addEvidence"). */
    @Transactional
    public PekApiDtos.EvidenceFileUploadResponse uploadEvidenceFile(Long id, MultipartFile file, Long version, Long userId) throws IOException {
        PekReportExceedance exceedance = getOrThrow(id);
        PekReport report = requireReportAccess(exceedance.getReportId());
        User actor = kz.eco.auth.CurrentUser.get();
        boolean canAddEvidence = REVIEWER_ROLES.contains(actor.getRole())
                || actor.getRole() == UserRole.ECOLOGIST || actor.getRole() == UserRole.LABORATORY;
        if (!canAddEvidence) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Недостаточно прав для прикрепления файлов к превышению");
        }
        if (!exceedance.getStatus().isOpen()) {
            throw new ConflictException(
                    "Нельзя прикрепить файл к завершённому превышению", "PEK_EXCEEDANCE_NOT_OPEN");
        }
        checkVersion(exceedance, version);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан");
        }
        if (file.getSize() > MAX_EVIDENCE_FILE_SIZE_BYTES) {
            throw new PayloadTooLargeException(
                    "Размер файла превышает допустимый лимит " + (MAX_EVIDENCE_FILE_SIZE_BYTES / (1024 * 1024)) + " МБ");
        }
        byte[] content = file.getBytes();
        PekProgramDocumentFileValidator.validate(file.getOriginalFilename(), file.getContentType(), content);
        StoredFileMetadata stored = fileStorageService.storeBytes(
                content, file.getOriginalFilename(), file.getContentType(),
                PekEvidenceFileAccessService.contextFor(id), String.valueOf(userId));
        // Touching updatedAt bumps the JPA @Version so the response can hand back a fresh version
        // for the follow-up POST .../evidence attach call's If-Match - the upload itself is now a
        // tracked mutation of the exceedance, not a side-channel write invisible to optimistic locking.
        exceedance.setUpdatedAt(LocalDateTime.now());
        PekReportExceedance saved = saveWithLockCheck(exceedance);
        contentRevisionService.bump(report);
        return new PekApiDtos.EvidenceFileUploadResponse(
                stored.fileId(), stored.filename(), stored.contentType(), stored.size(), saved.getVersion());
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ExceedanceResponse> listByReport(Long reportId) {
        requireReportAccess(reportId);
        return exceedanceRepository.findByReportId(reportId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ExceedanceResponse get(Long id) {
        PekReportExceedance exceedance = getOrThrow(id);
        requireReportAccess(exceedance.getReportId());
        return toResponse(exceedance);
    }

    @Transactional
    public PekApiDtos.ExceedanceResponse assignResponsible(Long id, PekApiDtos.AssignExceedanceResponsibleRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(id);
        PekReport report = requireReportAccess(exceedance.getReportId());
        // Module fix: the caller's own role was never checked here - report access alone let
        // LABORATORY (and any other PEK_REPORT_EDIT-eligible role) assign a responsible via a
        // direct API call even though the UI never shows them that option. Must match
        // buildAvailableActions()'s "assignResponsible" flag exactly (reviewer or ECOLOGIST).
        UserRole callerRole = kz.eco.auth.CurrentUser.get().getRole();
        if (!REVIEWER_ROLES.contains(callerRole) && callerRole != UserRole.ECOLOGIST) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Назначать ответственного может только ADMIN, DIRECTOR, HEAD или ECOLOGIST");
        }
        checkVersion(exceedance, version);
        if (request.responsibleUserId() != null) {
            requireEligibleAssignee(report.getCompanyId(), request.responsibleUserId());
            exceedance.setResponsibleUserId(request.responsibleUserId());
        }
        if (request.dueDate() != null) {
            exceedance.setDueDate(LocalDate.parse(request.dueDate()));
        }
        if (request.correctiveAction() != null) {
            exceedance.setCorrectiveAction(request.correctiveAction());
        }
        exceedance.setUpdatedAt(LocalDateTime.now());
        PekApiDtos.ExceedanceResponse response = toResponse(saveWithLockCheck(exceedance));
        contentRevisionService.bump(report);
        return response;
    }

    @Transactional
    public PekApiDtos.ExceedanceResponse attachEvidence(Long id, PekApiDtos.AttachExceedanceEvidenceRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(id);
        PekReport report = requireReportAccess(exceedance.getReportId());
        // Module fix: must match buildAvailableActions()'s "addEvidence" flag exactly - any of the
        // three working roles, but only while the exceedance is still open (a closed/cancelled/
        // resolved exceedance is done; attaching evidence to it after the fact makes no sense and
        // was previously silently allowed).
        UserRole callerRole = kz.eco.auth.CurrentUser.get().getRole();
        boolean canAddEvidence = REVIEWER_ROLES.contains(callerRole)
                || callerRole == UserRole.ECOLOGIST || callerRole == UserRole.LABORATORY;
        if (!canAddEvidence) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Недостаточно прав для прикрепления файлов к превышению");
        }
        if (!exceedance.getStatus().isOpen()) {
            throw new ConflictException(
                    "Нельзя прикрепить файл к завершённому превышению", "PEK_EXCEEDANCE_NOT_OPEN");
        }
        checkVersion(exceedance, version);
        if (request.fileId() == null || request.fileId().isBlank()) {
            throw new BadRequestException("Укажите fileId");
        }
        evidenceFileAccessService.requireAccessibleForExceedance(request.fileId(), id, kz.eco.auth.CurrentUser.get());
        PekExceedanceEvidenceFile evidence = new PekExceedanceEvidenceFile();
        evidence.setExceedanceId(exceedance.getId());
        evidence.setFileId(request.fileId());
        evidence.setUploadedBy(userId);
        evidenceRepository.save(evidence);
        exceedance.setUpdatedAt(LocalDateTime.now());
        PekApiDtos.ExceedanceResponse response = toResponse(saveWithLockCheck(exceedance));
        contentRevisionService.bump(report);
        return response;
    }

    /** Validates corrective-action-workflow content before allowing a terminal RESOLVED/CLOSED
     *  transition (module spec: "close requires resolutionComment+correctiveAction") - never just
     *  flips the status field without that content present, whether it arrived in this same request
     *  or was set earlier via {@link #assignResponsible}. */
    @Transactional
    public PekApiDtos.ExceedanceResponse transition(Long id, PekApiDtos.TransitionExceedanceRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(id);
        PekReport report = requireReportAccess(exceedance.getReportId());
        checkVersion(exceedance, version);
        if (request.status() == null || request.status().isBlank()) {
            throw new BadRequestException("Укажите status");
        }
        PekExceedanceStatus target;
        try {
            target = PekExceedanceStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Некорректный статус: " + request.status());
        }
        PekExceedanceStatus from = exceedance.getStatus();
        if (!from.canTransitionTo(target)) {
            throw new ConflictException("Переход из " + from + " в " + target + " недопустим",
                    "PEK_EXCEEDANCE_INVALID_TRANSITION");
        }
        // Closing a confirmed exceedance is a reviewer-only decision (ADMIN/DIRECTOR/HEAD) - the
        // "transitionToClosed" flag in toResponse already reflects this for the UI, but that flag
        // is presentational only; the server must reject a direct API call from ECOLOGIST/
        // LABORATORY too, not just hide the button.
        if (target == PekExceedanceStatus.CLOSED) {
            User currentUser = kz.eco.auth.CurrentUser.get();
            if (!REVIEWER_ROLES.contains(currentUser.getRole())) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Закрыть превышение может только ADMIN, DIRECTOR или HEAD");
            }
        }
        if (request.resolutionComment() != null) {
            exceedance.setResolutionComment(request.resolutionComment());
        }
        if ((target == PekExceedanceStatus.RESOLVED || target == PekExceedanceStatus.CLOSED)
                && (blank(exceedance.getResolutionComment()) || blank(exceedance.getCorrectiveAction()))) {
            throw new BadRequestException(
                    "Для закрытия превышения требуется указать correctiveAction и resolutionComment",
                    "PEK_EXCEEDANCE_RESOLUTION_INCOMPLETE");
        }
        exceedance.setStatus(target);
        exceedance.setComment(request.comment());
        if (target == PekExceedanceStatus.RESOLVED || target == PekExceedanceStatus.CLOSED
                || target == PekExceedanceStatus.VERIFIED) {
            exceedance.setCompletedAt(LocalDateTime.now());
            exceedance.setCompletedBy(userId);
            // Populated for PekExceedanceResponse (resolvedAt/resolvedBy/resolution fields).
            exceedance.setResolvedAt(LocalDateTime.now());
            exceedance.setResolvedBy(userId);
            exceedance.setResolution(exceedance.getResolutionComment());
        }
        if (target == PekExceedanceStatus.FALSE_POSITIVE) {
            exceedance.setResolvedAt(LocalDateTime.now());
            exceedance.setResolvedBy(userId);
            exceedance.setResolution(request.comment());
        }
        exceedance.setUpdatedAt(LocalDateTime.now());
        PekApiDtos.ExceedanceResponse response = toResponse(saveWithLockCheck(exceedance));
        contentRevisionService.bump(report);
        return response;
    }

    /** Corrective actions are a child sub-resource of the exceedance aggregate - If-Match on every
     *  endpoint below is the EXCEEDANCE's own optimistic-lock version (same convention as
     *  PekProgramMonitoringService's If-Match being the parent program's version), so two
     *  concurrent corrective-action edits on the same exceedance are always serialised against one
     *  another, and every mutation bumps the report's contentRevision like any other exceedance
     *  change. Role gate mirrors assignResponsible()'s (reviewer or ECOLOGIST) since planning/
     *  tracking corrective actions is the same kind of work. */
    @Transactional
    public PekApiDtos.CorrectiveActionResponse createCorrectiveAction(
            Long exceedanceId, PekApiDtos.CorrectiveActionRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(exceedanceId);
        PekReport report = requireReportAccess(exceedance.getReportId());
        requireCorrectiveActionActor();
        checkVersion(exceedance, version);
        if (!exceedance.getStatus().isOpen()) {
            throw new ConflictException(
                    "Нельзя добавить корректирующее мероприятие к завершённому превышению", "PEK_EXCEEDANCE_NOT_OPEN");
        }
        if (blank(request.description())) {
            throw new BadRequestException("Укажите description");
        }
        if (request.responsibleUserId() != null) {
            requireEligibleAssignee(report.getCompanyId(), request.responsibleUserId());
        }
        PekExceedanceCorrectiveAction action = new PekExceedanceCorrectiveAction();
        action.setExceedanceId(exceedanceId);
        action.setDescription(request.description().trim());
        action.setResponsibleUserId(request.responsibleUserId());
        action.setDueDate(request.dueDate() == null || request.dueDate().isBlank() ? null : LocalDate.parse(request.dueDate()));
        action.setCreatedBy(userId);
        correctiveActionRepository.saveAndFlush(action);
        touchExceedance(exceedance, report);
        auditCorrectiveAction(action.getId(), userId, "CREATE", null, action.getStatus().name(), action.getDescription());
        return toCorrectiveActionResponse(action);
    }

    @Transactional
    public PekApiDtos.CorrectiveActionResponse updateCorrectiveAction(
            Long exceedanceId, Long actionId, PekApiDtos.CorrectiveActionRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(exceedanceId);
        PekReport report = requireReportAccess(exceedance.getReportId());
        requireCorrectiveActionActor();
        checkVersion(exceedance, version);
        PekExceedanceCorrectiveAction action = getCorrectiveActionOrThrow(exceedanceId, actionId);
        if (!action.getStatus().isOpen()) {
            throw new ConflictException(
                    "Нельзя изменить завершённое корректирующее мероприятие", "PEK_CORRECTIVE_ACTION_NOT_OPEN");
        }
        if (request.description() != null) {
            if (blank(request.description())) {
                throw new BadRequestException("Укажите description");
            }
            action.setDescription(request.description().trim());
        }
        if (request.responsibleUserId() != null) {
            requireEligibleAssignee(report.getCompanyId(), request.responsibleUserId());
            action.setResponsibleUserId(request.responsibleUserId());
        }
        if (request.dueDate() != null) {
            action.setDueDate(request.dueDate().isBlank() ? null : LocalDate.parse(request.dueDate()));
        }
        action.setUpdatedAt(LocalDateTime.now());
        correctiveActionRepository.saveAndFlush(action);
        touchExceedance(exceedance, report);
        auditCorrectiveAction(action.getId(), userId, "UPDATE", null, action.getStatus().name(), action.getDescription());
        return toCorrectiveActionResponse(action);
    }

    @Transactional
    public void deleteCorrectiveAction(Long exceedanceId, Long actionId, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(exceedanceId);
        PekReport report = requireReportAccess(exceedance.getReportId());
        requireCorrectiveActionActor();
        checkVersion(exceedance, version);
        PekExceedanceCorrectiveAction action = getCorrectiveActionOrThrow(exceedanceId, actionId);
        correctiveActionRepository.delete(action);
        touchExceedance(exceedance, report);
        auditCorrectiveAction(actionId, userId, "DELETE", action.getStatus().name(), null, action.getDescription());
    }

    @Transactional
    public PekApiDtos.CorrectiveActionResponse transitionCorrectiveAction(
            Long exceedanceId, Long actionId, PekApiDtos.CorrectiveActionTransitionRequest request, Long version, Long userId) {
        PekReportExceedance exceedance = getOrThrow(exceedanceId);
        PekReport report = requireReportAccess(exceedance.getReportId());
        requireCorrectiveActionActor();
        checkVersion(exceedance, version);
        PekExceedanceCorrectiveAction action = getCorrectiveActionOrThrow(exceedanceId, actionId);
        if (request.status() == null || request.status().isBlank()) {
            throw new BadRequestException("Укажите status");
        }
        PekCorrectiveActionStatus target;
        try {
            target = PekCorrectiveActionStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Некорректный статус: " + request.status());
        }
        PekCorrectiveActionStatus from = action.getStatus();
        if (!from.canTransitionTo(target)) {
            throw new ConflictException("Переход из " + from + " в " + target + " недопустим",
                    "PEK_CORRECTIVE_ACTION_INVALID_TRANSITION");
        }
        action.setStatus(target);
        if (request.comment() != null) {
            action.setComment(request.comment());
        }
        if (target == PekCorrectiveActionStatus.DONE) {
            action.setCompletedAt(LocalDateTime.now());
            action.setCompletedBy(userId);
        }
        action.setUpdatedAt(LocalDateTime.now());
        correctiveActionRepository.saveAndFlush(action);
        touchExceedance(exceedance, report);
        auditCorrectiveAction(action.getId(), userId, "TRANSITION", from.name(), target.name(), request.comment());
        return toCorrectiveActionResponse(action);
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.CorrectiveActionResponse> listCorrectiveActions(Long exceedanceId) {
        PekReportExceedance exceedance = getOrThrow(exceedanceId);
        requireReportAccess(exceedance.getReportId());
        return correctiveActionRepository.findByExceedanceIdOrderByIdAsc(exceedanceId).stream()
                .map(this::toCorrectiveActionResponse).toList();
    }

    private void requireCorrectiveActionActor() {
        UserRole callerRole = kz.eco.auth.CurrentUser.get().getRole();
        if (!REVIEWER_ROLES.contains(callerRole) && callerRole != UserRole.ECOLOGIST) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Недостаточно прав для работы с корректирующими мероприятиями");
        }
    }

    private PekExceedanceCorrectiveAction getCorrectiveActionOrThrow(Long exceedanceId, Long actionId) {
        return correctiveActionRepository.findByIdAndExceedanceId(actionId, exceedanceId)
                .orElseThrow(() -> new NotFoundException("Корректирующее мероприятие не найдено: " + actionId));
    }

    private void touchExceedance(PekReportExceedance exceedance, PekReport report) {
        exceedance.setUpdatedAt(LocalDateTime.now());
        saveWithLockCheck(exceedance);
        contentRevisionService.bump(report);
    }

    private void auditCorrectiveAction(Long actionId, Long userId, String actionType, String oldStatus, String newStatus, String comment) {
        User actor = userId != null ? userRepository.findById(userId).orElse(null) : null;
        auditLogService.log(CORRECTIVE_ACTION_ENTITY_TYPE, actionId, null, actor, actionType, oldStatus, newStatus, comment);
    }

    private PekApiDtos.CorrectiveActionResponse toCorrectiveActionResponse(PekExceedanceCorrectiveAction a) {
        PekApiDtos.UserShortDto responsible = a.getResponsibleUserId() == null ? null
                : userRepository.findById(a.getResponsibleUserId())
                        .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                        .orElse(null);
        UserRole role = kz.eco.auth.CurrentUser.getOrNull() == null ? null : kz.eco.auth.CurrentUser.getOrNull().getRole();
        boolean canEdit = (REVIEWER_ROLES.contains(role) || role == UserRole.ECOLOGIST) && a.getStatus().isOpen();
        java.util.Map<String, Boolean> actions = new java.util.LinkedHashMap<>();
        actions.put("edit", canEdit);
        actions.put("delete", canEdit);
        actions.put("transition", canEdit);
        return new PekApiDtos.CorrectiveActionResponse(
                a.getId(), a.getExceedanceId(), a.getDescription(), a.getResponsibleUserId(), responsible,
                a.getDueDate() == null ? null : a.getDueDate().toString(), a.getStatus().name(), a.getComment(),
                a.getCompletedAt() == null ? null : a.getCompletedAt().toString(), a.getCompletedBy(),
                a.getCreatedAt() == null ? null : a.getCreatedAt().toString(),
                a.getUpdatedAt() == null ? null : a.getUpdatedAt().toString(), a.getVersion(), actions);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private PekReport requireReportAccess(Long reportId) {
        PekReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        // Defense-in-depth: assert a real authenticated user rather than silently no-op'ing the
        // access check when absent (unreachable in practice behind @PreAuthorize, but a missing
        // CurrentUser must never be treated as "skip the check").
        User user = kz.eco.auth.CurrentUser.get();
        accessService.requireReportAccess(user.getId(), user.getRole(), report);
        return report;
    }

    /** Module fix: assignResponsible previously only checked that responsibleUserId resolves to
     *  *some* user row, with no company-membership or role check at all - a caller could assign a
     *  user from an unrelated company (or one with no PEK access whatsoever) as responsible for a
     *  corrective action they'd never be able to see or act on. */
    private void requireEligibleAssignee(Long companyId, Long candidateUserId) {
        User candidate = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + candidateUserId));
        if (candidate.getStatus() != kz.eco.user.UserStatus.active) {
            throw new BadRequestException("Пользователь неактивен", "PEK_ASSIGNEE_INACTIVE");
        }
        if (!ELIGIBLE_ASSIGNEE_ROLES.contains(candidate.getRole())) {
            throw new BadRequestException("Роль пользователя не предусматривает работу с ПЭК",
                    "PEK_ASSIGNEE_ROLE_NOT_ELIGIBLE");
        }
        boolean member = membershipRepository.existsByCompanyIdAndUserIdAndStatus(
                companyId, candidateUserId, PekMembershipStatus.ACTIVE);
        if (!member) {
            throw new BadRequestException(
                    "Пользователь не состоит в участниках ПЭК данной компании", "PEK_ASSIGNEE_NOT_MEMBER");
        }
    }

    private PekReportExceedance saveWithLockCheck(PekReportExceedance exceedance) {
        try {
            return exceedanceRepository.saveAndFlush(exceedance);
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
            throw new ConflictException("Превышение было изменено другим пользователем", "PEK_EXCEEDANCE_VERSION_CONFLICT");
        }
    }

    private static void checkVersion(PekReportExceedance exceedance, Long requestVersion) {
        if (requestVersion == null) throw new BadRequestException("Требуется version", "VERSION_REQUIRED");
        if (!requestVersion.equals(exceedance.getVersion()))
            throw ConflictException.versionConflict("Превышение было изменено другим пользователем", "PEK_EXCEEDANCE_VERSION_CONFLICT", exceedance.getVersion());
    }

    PekReportExceedance getOrThrow(Long id) {
        return exceedanceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Превышение не найдено: " + id));
    }

    private PekApiDtos.ExceedanceResponse toResponse(PekReportExceedance e) {
        PekApiDtos.UserShortDto responsible = e.getResponsibleUserId() == null ? null
                : userRepository.findById(e.getResponsibleUserId())
                        .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                        .orElse(null);
        List<String> evidenceIds = evidenceRepository.findByExceedanceIdOrderByUploadedAtDesc(e.getId()).stream()
                .map(PekExceedanceEvidenceFile::getFileId).toList();

        User currentUser = kz.eco.auth.CurrentUser.getOrNull();
        UserRole role = currentUser == null ? null : currentUser.getRole();
        java.util.Map<String, Boolean> actions = buildAvailableActions(e, role);

        return new PekApiDtos.ExceedanceResponse(
                e.getId(), e.getReportId(), e.getPlanFactRowId(), e.getProtocolId(), e.getProtocolResultId(),
                e.getProgramIndicatorId(), e.getActualValue(), e.getNormativeValue(),
                e.getComparisonType() == null ? null : e.getComparisonType().name(), e.getExceedanceRatio(),
                e.getSeverity() == null ? null : e.getSeverity().name(), e.getStatus().name(), e.getComment(),
                e.getResponsibleUserId(), responsible, e.getCorrectiveAction(),
                e.getDueDate() == null ? null : e.getDueDate().toString(),
                e.getCompletedAt() == null ? null : e.getCompletedAt().toString(), e.getCompletedBy(),
                e.getResolutionComment(), evidenceIds,
                e.getResolvedAt() == null ? null : e.getResolvedAt().toString(), e.getResolvedBy(), e.getResolution(),
                e.getCreatedAt() == null ? null : e.getCreatedAt().toString(),
                e.getUpdatedAt() == null ? null : e.getUpdatedAt().toString(), e.getVersion(), actions);
    }

    /** Per-action permission matrix (module fix: previously a single generic PEK_REPORT_EDIT-style
     *  role gate covered every exceedance action, so any role that could touch the report at all
     *  could also assign responsibles or (before an earlier fix) close it). Every key here has a
     *  matching server-side check in the corresponding method - this map is a projection of those
     *  checks, never an independent second source of truth, so the frontend can render buttons
     *  from it without re-deriving role+status logic, and a direct API call is rejected the same
     *  way regardless of what the map said. */
    private java.util.Map<String, Boolean> buildAvailableActions(PekReportExceedance e, UserRole role) {
        boolean reviewer = REVIEWER_ROLES.contains(role);
        boolean ecologist = role == UserRole.ECOLOGIST;
        boolean laboratory = role == UserRole.LABORATORY;
        boolean open = e.getStatus().isOpen();

        java.util.Map<String, Boolean> actions = new java.util.LinkedHashMap<>();
        actions.put("view", true);
        // assignResponsible: reviewer roles plus ECOLOGIST (module spec: ECOLOGIST works the
        // exceedance short of administrative actions) - LABORATORY must never see this as true,
        // even though it can view and add evidence.
        actions.put("assignResponsible", reviewer || ecologist);
        // addEvidence: every role actually allowed to work the exceedance, but only while it's
        // still open - matches attachEvidence()'s own isOpen() check below.
        actions.put("addEvidence", (reviewer || ecologist || laboratory) && open);
        // changeStatus: any non-CLOSED transition (RESOLVED/VERIFIED/etc.) - reviewer or
        // ECOLOGIST, while still open. LABORATORY only ever gets addEvidence, never a status change.
        actions.put("changeStatus", (reviewer || ecologist) && open
                && java.util.Arrays.stream(PekExceedanceStatus.values())
                        .anyMatch(target -> target != PekExceedanceStatus.CLOSED && e.getStatus().canTransitionTo(target)));
        // close: reviewer-only (ADMIN/DIRECTOR/HEAD), and only when the state machine actually
        // allows a transition to CLOSED from here - mirrors transition()'s own guard exactly.
        actions.put("close", reviewer && e.getStatus().canTransitionTo(PekExceedanceStatus.CLOSED));
        // reopen: no state in PekExceedanceStatus.ALLOWED_TRANSITIONS currently leads out of
        // CLOSED (it's terminal by design) - always false today, kept as its own key rather than
        // silently omitted so the frontend doesn't have to special-case a missing field, and so
        // this becomes non-trivial automatically if the state machine ever adds a real transition.
        actions.put("reopen", false);
        // edit: same reviewer-or-ECOLOGIST gate as assignResponsible (both go through the same
        // assignResponsible() method, which is also how corrective-action/due-date fields are edited).
        actions.put("edit", reviewer || ecologist);
        return actions;
    }
}
