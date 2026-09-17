package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekStaffAssignmentDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** CRUD for {@link PekStaffAssignment} - the real source of truth {@link PekAccessService} reads
 *  for company-scope/permission resolution (see that class + this entity's javadoc for why this
 *  replaces {@link PekCompanyMembership} in that role). Every mutation re-checks
 *  {@link PekAccessService#requireCompanyEditPermission} itself rather than trusting the
 *  controller's role-only {@code @PreAuthorize} alone - same defense-in-depth convention as
 *  {@link PekCompanyMembershipService}. */
@Service
public class PekStaffAssignmentService {

    private final PekStaffAssignmentRepository repository;
    private final UserRepository userRepository;
    private final PekAccessService accessService;

    public PekStaffAssignmentService(PekStaffAssignmentRepository repository, UserRepository userRepository,
                                      PekAccessService accessService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<PekStaffAssignmentDtos.PekStaffAssignmentDto> list(Long companyId, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        return repository.findByCompanyIdOrderByCreatedAtAsc(companyId).stream().map(this::toDto).toList();
    }

    /** Upsert on (company_id, user_id) - reassigning an existing user updates their tier rather
     *  than creating a duplicate row. Rejects any target account whose global role is not a staff
     *  role (module fix: this table must never represent a client company's own employees). */
    @Transactional
    public PekStaffAssignmentDtos.PekStaffAssignmentDto assign(Long companyId, PekStaffAssignmentDtos.AssignPekStaffRequest request,
                                                                Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyEditPermission(actorUserId, actorRole, companyId);

        String normalizedEmail = request.email() == null ? "" : request.email().trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new BadRequestException("Укажите email сотрудника");
        }
        User target = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Пользователь с указанным email не найден", "MEMBER_NOT_FOUND"));
        if (!target.getRole().isStaffAccount()) {
            throw new BadRequestException(
                    "Назначать можно только сотрудников компании (staff-аккаунт), не клиентские учётные записи",
                    "PEK_STAFF_ASSIGNMENT_NOT_STAFF_ACCOUNT");
        }
        PekStaffTier tier = request.tier() != null && !request.tier().isBlank()
                ? parseTier(request.tier())
                : PekStaffTier.defaultForRole(target.getRole());

        PekStaffAssignment assignment = repository.findByCompanyIdAndUserId(companyId, target.getId())
                .orElseGet(() -> {
                    PekStaffAssignment created = new PekStaffAssignment();
                    created.setCompanyId(companyId);
                    created.setUserId(target.getId());
                    created.setAssignedBy(actorUserId);
                    return created;
                });
        assignment.setTier(tier);
        assignment.setStatus(PekMembershipStatus.ACTIVE);
        assignment.setUpdatedAt(LocalDateTime.now());
        repository.saveAndFlush(assignment);
        return toDto(assignment);
    }

    @Transactional
    public PekStaffAssignmentDtos.PekStaffAssignmentDto update(Long companyId, Long assignmentId,
                                                                PekStaffAssignmentDtos.UpdatePekStaffAssignmentRequest request,
                                                                Long version, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyEditPermission(actorUserId, actorRole, companyId);
        PekStaffAssignment assignment = getInCompany(companyId, assignmentId);
        checkVersion(assignment, version);

        if (request.tier() != null && !request.tier().isBlank()) {
            assignment.setTier(parseTier(request.tier()));
        }
        if (request.status() != null && !request.status().isBlank()) {
            assignment.setStatus(parseStatus(request.status()));
        }
        assignment.setUpdatedAt(LocalDateTime.now());
        repository.saveAndFlush(assignment);
        return toDto(assignment);
    }

    @Transactional
    public void remove(Long companyId, Long assignmentId, Long version, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyEditPermission(actorUserId, actorRole, companyId);
        PekStaffAssignment assignment = getInCompany(companyId, assignmentId);
        checkVersion(assignment, version);
        assignment.setStatus(PekMembershipStatus.REMOVED);
        assignment.setUpdatedAt(LocalDateTime.now());
        repository.saveAndFlush(assignment);
    }

    private PekStaffAssignment getInCompany(Long companyId, Long assignmentId) {
        return repository.findByIdAndCompanyId(assignmentId, companyId)
                .orElseThrow(() -> new NotFoundException("Назначение не найдено", "PEK_STAFF_ASSIGNMENT_NOT_FOUND"));
    }

    /** If-Match is mandatory on update/remove (module fix item 3) - assign() is a create/upsert
     *  (no prior state a caller could be racing against), so it deliberately has no version param,
     *  same convention as PekProgramMonitoringService#create. */
    private void checkVersion(PekStaffAssignment assignment, Long version) {
        if (version == null) {
            throw new BadRequestException("Требуется версия (заголовок If-Match)", "VERSION_REQUIRED");
        }
        if (!version.equals(assignment.getVersion())) {
            throw ConflictException.versionConflict("Назначение было изменено другим сотрудником", "PEK_VERSION_CONFLICT", assignment.getVersion());
        }
    }

    private PekStaffTier parseTier(String raw) {
        try {
            return PekStaffTier.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимый уровень доступа: " + raw);
        }
    }

    private PekMembershipStatus parseStatus(String raw) {
        try {
            return PekMembershipStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимый статус. Допустимо: ACTIVE, INVITED, REMOVED");
        }
    }

    private PekStaffAssignmentDtos.PekStaffAssignmentDto toDto(PekStaffAssignment assignment) {
        User user = userRepository.findById(assignment.getUserId()).orElse(null);
        return new PekStaffAssignmentDtos.PekStaffAssignmentDto(
                assignment.getId(),
                assignment.getCompanyId(),
                assignment.getUserId(),
                user != null ? user.getName() : null,
                user != null ? user.getEmail() : null,
                assignment.getTier().name(),
                assignment.getStatus().name(),
                assignment.getCreatedAt(),
                assignment.getUpdatedAt(),
                assignment.getVersion()
        );
    }
}
