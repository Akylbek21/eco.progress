package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyObject;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Full CRUD + status-transition service for {@link PekEnvironmentalPermit} (Iteration 2 of the
 * PEK module overhaul) - replaces {@link PekLookupService#permitsForObject}'s previously
 * hardcoded empty list with real, tenant-scoped rows. Tenant scope itself is enforced by the
 * caller (PekController/PekPermitController call PekAccessService#requireObjectAccess /
 * requireCompanyAccess before delegating here), matching the rest of the PEK module's convention
 * that access checks live at the controller boundary - this class never bypasses it.
 */
@Service
public class PekPermitService {

    private static final long MAX_FILE_SIZE_BYTES = 25L * 1024 * 1024;

    private final PekEnvironmentalPermitRepository permits;
    private final PekPermitHistoryRepository history;
    private final PekProgramRepository programs;
    private final PekAccessService accessService;
    private final UserRepository userRepository;
    private final kz.eco.storage.FileStorageService fileStorageService;

    public PekPermitService(PekEnvironmentalPermitRepository permits, PekPermitHistoryRepository history,
                             PekProgramRepository programs, PekAccessService accessService,
                             UserRepository userRepository, kz.eco.storage.FileStorageService fileStorageService) {
        this.permits = permits;
        this.history = history;
        this.programs = programs;
        this.accessService = accessService;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    /** POST /api/pek/permits/files - stores the file and returns its fileId for a later create/
     *  update call to reference; never mutates a permit row itself. When permitId is given (the
     *  "replace an existing permit's file" case), version must match the permit's current
     *  optimistic-lock version, so the caller cannot upload against a permit that has since
     *  changed under them. */
    @Transactional
    public PekApiDtos.PermitFileUploadResponse uploadFile(Long companyId, Long permitId, Long version,
                                                            org.springframework.web.multipart.MultipartFile file,
                                                            Long userId) throws java.io.IOException {
        if (permitId != null) {
            PekEnvironmentalPermit permit = getOrThrow(permitId);
            if (!permit.getCompanyId().equals(companyId)) {
                throw new BadRequestException("Разрешение " + permitId + " принадлежит другой компании", "PEK_PERMIT_WRONG_COMPANY");
            }
            checkVersion(permit, version);
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new kz.eco.common.exception.PayloadTooLargeException(
                    "Размер файла превышает допустимый лимит " + (MAX_FILE_SIZE_BYTES / (1024 * 1024)) + " МБ");
        }
        byte[] content = file.getBytes();
        PekProgramDocumentFileValidator.validate(file.getOriginalFilename(), file.getContentType(), content);
        kz.eco.storage.StoredFileMetadata stored = fileStorageService.storeBytes(
                content, file.getOriginalFilename(), file.getContentType(),
                "pek-permit-" + (permitId != null ? permitId : companyId), String.valueOf(userId));
        return new PekApiDtos.PermitFileUploadResponse(stored.fileId(), stored.filename(), stored.contentType(), stored.size());
    }

    public PekEnvironmentalPermit getOrThrow(Long id) {
        return permits.findById(id)
                .orElseThrow(() -> new NotFoundException("Разрешение не найдено: " + id));
    }

    /**
     * Loads the permit's attached file. The fileId comes exclusively from the persisted permit row
     * - a client-supplied fileId is never accepted here, so knowing another company's fileId grants
     * nothing (the caller's company access is checked against this permit's companyId by
     * {@link PekPermitController} before this method is reached).
     */
    @Transactional(readOnly = true)
    public kz.eco.storage.StoredFileContent downloadFile(Long permitId) {
        PekEnvironmentalPermit permit = getOrThrow(permitId);
        String fileId = permit.getFileId();
        if (fileId == null || fileId.isBlank()) {
            throw new NotFoundException("К разрешению не прикреплён файл: " + permitId);
        }
        try {
            return fileStorageService.load(fileId);
        } catch (java.io.IOException ex) {
            throw new NotFoundException("Файл разрешения недоступен: " + permitId);
        }
    }

    @Transactional(readOnly = true)
    public PekApiDtos.PermitResponse get(Long id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.PermitResponse> listByObject(Long objectId) {
        return permits.findByObjectIdOrderByValidToDesc(objectId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public PekApiDtos.PermitResponse create(PekApiDtos.CreatePermitRequest request, Long userId) {
        if (request.companyId() == null) throw new BadRequestException("Укажите companyId");
        if (request.objectId() == null) throw new BadRequestException("Укажите objectId");
        CompanyObject object = accessService.requireObjectBelongsToCompany(request.companyId(), request.objectId());
        if (request.type() == null || request.type().isBlank()) throw new BadRequestException("Укажите type");
        if (request.number() == null || request.number().isBlank()) throw new BadRequestException("Укажите номер разрешения");
        if (request.validFrom() == null || request.validTo() == null) throw new BadRequestException("Укажите срок действия разрешения");
        LocalDate validFrom = LocalDate.parse(request.validFrom());
        LocalDate validTo = LocalDate.parse(request.validTo());
        if (validTo.isBefore(validFrom)) {
            throw new BadRequestException("Дата окончания не может быть раньше даты начала", "PERMIT_INVALID_RANGE");
        }
        if (request.pekProgramId() != null) {
            requireProgramLinkable(request.pekProgramId(), request.companyId(), object.getId());
        }

        PekEnvironmentalPermit permit = new PekEnvironmentalPermit();
        permit.setCompanyId(request.companyId());
        permit.setObjectId(object.getId());
        permit.setType(request.type().trim());
        permit.setNumber(request.number().trim());
        permit.setIssuedAt(request.issuedAt() != null ? LocalDate.parse(request.issuedAt()) : validFrom);
        permit.setValidFrom(validFrom);
        permit.setValidTo(validTo);
        permit.setAuthority(request.authority() != null ? request.authority() : "");
        permit.setFileId(request.fileId());
        permit.setNote(request.note());
        permit.setPekProgramId(request.pekProgramId());
        permit.setStatus(PekPermitStatus.ACTIVE);
        permit.setCreatedBy(userId);
        permit.setUpdatedBy(userId);
        permit = permits.saveAndFlush(permit);
        recordHistory(permit.getId(), null, permit.getStatus(), "Создано", userId);
        return toResponse(permit);
    }

    @Transactional
    public PekApiDtos.PermitResponse update(Long id, PekApiDtos.UpdatePermitRequest request, Long version, Long userId) {
        PekEnvironmentalPermit permit = getOrThrow(id);
        checkVersion(permit, version);
        if (request.type() != null) permit.setType(request.type().trim());
        if (request.number() != null && !request.number().isBlank()) permit.setNumber(request.number().trim());
        if (request.issuedAt() != null) permit.setIssuedAt(LocalDate.parse(request.issuedAt()));
        if (request.validFrom() != null) permit.setValidFrom(LocalDate.parse(request.validFrom()));
        if (request.validTo() != null) permit.setValidTo(LocalDate.parse(request.validTo()));
        if (permit.getValidTo().isBefore(permit.getValidFrom())) {
            throw new BadRequestException("Дата окончания не может быть раньше даты начала", "PERMIT_INVALID_RANGE");
        }
        if (request.authority() != null) permit.setAuthority(request.authority());
        if (request.fileId() != null) permit.setFileId(request.fileId());
        if (request.note() != null) permit.setNote(request.note());
        if (request.pekProgramId() != null) {
            requireProgramLinkable(request.pekProgramId(), permit.getCompanyId(), permit.getObjectId());
            permit.setPekProgramId(request.pekProgramId());
        }
        permit.setUpdatedBy(userId);
        try {
            return toResponse(permits.saveAndFlush(permit));
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
            throw new ConflictException("Разрешение было изменено другим пользователем", "PEK_PERMIT_VERSION_CONFLICT");
        }
    }

    /** REVOKED/EXPIRED are terminal (see {@link PekPermitStatus#canTransitionTo}) - once set, a
     *  permit cannot be brought back to ACTIVE; a genuinely renewed permit gets a new row instead,
     *  so the audit trail of "this exact permit stopped being valid on this date" is never erased. */
    @Transactional
    public PekApiDtos.PermitResponse changeStatus(Long id, PekApiDtos.ChangePermitStatusRequest request, Long version, Long userId) {
        PekEnvironmentalPermit permit = getOrThrow(id);
        checkVersion(permit, version);
        if (request.status() == null || request.status().isBlank()) throw new BadRequestException("Укажите status");
        PekPermitStatus target;
        try {
            target = PekPermitStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Некорректный статус: " + request.status());
        }
        PekPermitStatus from = permit.getStatus();
        if (from == target) {
            return toResponse(permit);
        }
        if (!from.canTransitionTo(target)) {
            throw new ConflictException("Переход из " + from + " в " + target + " недопустим", "PEK_PERMIT_TRANSITION_INVALID");
        }
        permit.setStatus(target);
        permit.setUpdatedBy(userId);
        PekEnvironmentalPermit saved;
        try {
            saved = permits.saveAndFlush(permit);
        } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
            throw new ConflictException("Разрешение было изменено другим пользователем", "PEK_PERMIT_VERSION_CONFLICT");
        }
        recordHistory(saved.getId(), from, target, request.comment(), userId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.PermitHistoryEntry> history(Long id) {
        getOrThrow(id);
        return history.findByPermitIdOrderByPerformedAtAsc(id).stream()
                .map(h -> {
                    PekApiDtos.UserShortDto actor = userRepository.findById(h.getPerformedBy())
                            .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                            .orElse(null);
                    return new PekApiDtos.PermitHistoryEntry(h.getFromStatus(), h.getToStatus(), h.getComment(),
                            actor, h.getPerformedAt().toString());
                })
                .toList();
    }

    /** An EXPIRED/REVOKED permit, or one whose date range does not cover today, must never be
     *  treated as "the active permit backing this program" - used by readiness checks and by
     *  program-link validation. Throws rather than silently accepting a stale link. */
    public void requireActive(PekEnvironmentalPermit permit, LocalDate on) {
        if (!permit.isActiveOn(on)) {
            throw new ConflictException("Разрешение недействительно (статус " + permit.getStatus() + ")", "PEK_PERMIT_NOT_ACTIVE");
        }
    }

    /** Real-row lookup used by other services (e.g. readiness) that need to know whether a program
     *  currently has a usable permit - never fabricated. */
    @Transactional(readOnly = true)
    public boolean hasActivePermit(Long pekProgramId) {
        if (pekProgramId == null) return false;
        return permits.findByPekProgramId(pekProgramId).stream().anyMatch(p -> p.isActiveOn(LocalDate.now()));
    }

    private void requireProgramLinkable(Long programId, Long companyId, Long objectId) {
        PekProgram program = programs.findById(programId)
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + programId));
        if (!program.getCompanyId().equals(companyId) || !program.getObjectId().equals(objectId)) {
            throw new BadRequestException("Программа ПЭК относится к другому объекту", "PEK_PROGRAM_SCOPE_MISMATCH");
        }
    }

    private static void checkVersion(PekEnvironmentalPermit permit, Long requestVersion) {
        if (requestVersion == null) throw new BadRequestException("Требуется version", "VERSION_REQUIRED");
        if (!requestVersion.equals(permit.getVersion()))
            throw ConflictException.versionConflict("Разрешение было изменено другим пользователем", "PEK_PERMIT_VERSION_CONFLICT", permit.getVersion());
    }

    private void recordHistory(Long permitId, PekPermitStatus from, PekPermitStatus to, String comment, Long userId) {
        PekPermitHistory h = new PekPermitHistory();
        h.setPermitId(permitId);
        h.setFromStatus(from == null ? null : from.name());
        h.setToStatus(to.name());
        h.setComment(comment);
        h.setPerformedBy(userId);
        history.save(h);
    }

    private PekApiDtos.PermitResponse toResponse(PekEnvironmentalPermit p) {
        java.util.Map<String, Boolean> actions = java.util.Map.of(
                "edit", p.getStatus() == PekPermitStatus.ACTIVE,
                "markExpired", p.getStatus().canTransitionTo(PekPermitStatus.EXPIRED),
                "revoke", p.getStatus().canTransitionTo(PekPermitStatus.REVOKED));
        return new PekApiDtos.PermitResponse(
                p.getId(), p.getCompanyId(), p.getObjectId(), p.getType(), p.getNumber(),
                p.getIssuedAt() == null ? null : p.getIssuedAt().toString(),
                p.getValidFrom() == null ? null : p.getValidFrom().toString(),
                p.getValidTo() == null ? null : p.getValidTo().toString(),
                p.getAuthority(), p.getStatus().name(), p.isActiveOn(LocalDate.now()),
                p.getFileId(), p.getNote(), p.getPekProgramId(), p.getVersion(), actions);
    }
}
