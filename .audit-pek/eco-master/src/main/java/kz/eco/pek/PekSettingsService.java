package kz.eco.pek;

import kz.eco.audit.AuditLogService;
import kz.eco.auth.CurrentUser;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.ValidationException;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.dto.PekSettingsDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class PekSettingsService {
    private final PekSettingsRepository repository;
    private final PekStaffAssignmentRepository membershipRepository;
    private final UserRepository userRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final PekAccessService accessService;
    private final AuditLogService auditLogService;

    public PekSettingsService(PekSettingsRepository repository,
                              PekStaffAssignmentRepository membershipRepository, UserRepository userRepository,
                              LaboratoryRepository laboratoryRepository, PekAccessService accessService,
                              AuditLogService auditLogService) {
        this.repository=repository;
        this.membershipRepository=membershipRepository; this.userRepository=userRepository;
        this.laboratoryRepository=laboratoryRepository; this.accessService=accessService; this.auditLogService=auditLogService;
    }

    /** @param requestedCompanyId optional explicit companyId (validated against the caller's own
     *  access, never trusted blindly) - required for a global-access caller (ADMIN/DIRECTOR) with
     *  no implicit single company; a company-scoped caller may omit it and have it resolved from
     *  their own membership (see PekAccessService#resolveSingleCompanyId), matching the previous
     *  OrganizationResolver-based behavior this replaces (Iteration 1: removes the erroneous
     *  cross-module dependency on kz.ecoprogress.documentflow). */
    @Transactional
    public PekSettingsDtos.Response getCurrentCompanySettings(Long requestedCompanyId) {
        User user=CurrentUser.get();
        if (!accessService.canViewSettings(user)) throw new AccessDeniedException("Нет доступа к настройкам ПЭК");
        Long companyId = resolveCompanyId(user, requestedCompanyId);
        return toResponse(getEffectiveSettings(companyId), user, repository.findByCompanyId(companyId).isPresent());
    }

    @Transactional(readOnly = true)
    public PekSettings getEffectiveSettings(Long companyId) {
        return repository.findByCompanyId(companyId).orElseGet(() -> defaults(companyId));
    }

    @Transactional
    public PekSettingsDtos.Response updateSettings(PekSettingsDtos.UpdateRequest request, Long requestedCompanyId, Long version) {
        User actor=CurrentUser.get();
        if (!accessService.canEditSettings(actor)) throw new AccessDeniedException("Недостаточно прав для изменения настроек ПЭК");
        Long companyId = resolveCompanyId(actor, requestedCompanyId);
        validate(request, companyId);
        PekSettings entity=repository.findByCompanyId(companyId).orElse(null);
        Long currentVersion=entity == null ? 0L : entity.getVersion();
        if (version==null) throw new BadRequestException("Требуется version", "VERSION_REQUIRED");
        if (!version.equals(currentVersion))
            throw ConflictException.versionConflict("Настройки были изменены другим сотрудником", "PEK_SETTINGS_VERSION_CONFLICT", currentVersion);
        String oldValue=entity == null ? "defaults" : auditValue(entity);
        if (entity==null) { entity=defaults(companyId); entity.setCreatedBy(actor.getId()); }
        apply(entity, request);
        entity.setUpdatedBy(actor.getId());
        entity=repository.saveAndFlush(entity);
        auditLogService.log("PekSettings", entity.getId(), null, actor,
                currentVersion==0L && "defaults".equals(oldValue) ? "CREATED" : "UPDATED",
                oldValue, auditValue(entity), "companyId="+companyId);
        return toResponse(entity, actor, true);
    }

    public Long defaultResponsibleUserId(Long companyId) { return getEffectiveSettings(companyId).getDefaultResponsibleUserId(); }
    public PekPeriodType defaultPeriodType(Long companyId) { return getEffectiveSettings(companyId).getDefaultReportType().toPeriodType(); }

    /** Replaces the old {@code OrganizationResolver.resolve(userId, null)} call - same semantics
     *  (explicit id validated against the caller's own access; otherwise resolved from exactly one
     *  membership, erroring if zero or several), now backed by {@link PekStaffAssignmentRepository}
     *  instead of the document-flow module's membership table. */
    private Long resolveCompanyId(User user, Long requestedCompanyId) {
        if (requestedCompanyId != null) {
            accessService.requireCompanyAccess(user.getId(), user.getRole(), requestedCompanyId);
            return requestedCompanyId;
        }
        return accessService.resolveSingleCompanyId(user.getId(), user.getRole());
    }

    private void validate(PekSettingsDtos.UpdateRequest r, Long companyId) {
        Map<String,String> errors=new LinkedHashMap<>();
        if (r.notifyBeforeDeadlineDays()==null || r.notifyBeforeDeadlineDays()<0 || r.notifyBeforeDeadlineDays()>365)
            errors.put("notifyBeforeDeadlineDays", "Укажите значение от 0 до 365");
        if (r.defaultResponsibleUserId()!=null) {
            User user=userRepository.findById(r.defaultResponsibleUserId()).orElse(null);
            boolean member=membershipRepository.existsByCompanyIdAndUserIdAndStatus(companyId, r.defaultResponsibleUserId(), PekMembershipStatus.ACTIVE);
            if (user==null || user.getStatus()!=UserStatus.active || !user.getRole().isStaffAccount() || !member)
                errors.put("defaultResponsibleUserId", "Сотрудник неактивен, не имеет доступа к компании или не может быть ответственным за ПЭК");
        }
        if (r.defaultLaboratoryId()!=null) {
            Laboratory lab=laboratoryRepository.findById(r.defaultLaboratoryId()).orElse(null);
            if (lab==null || !lab.isActive()) errors.put("defaultLaboratoryId", "Лаборатория не найдена или неактивна");
        }
        if (r.defaultReportType()==null) errors.put("defaultReportType", "Укажите тип отчёта");
        else try { PekSettingsReportType.valueOf(r.defaultReportType().trim().toUpperCase()); }
        catch (IllegalArgumentException ex) { errors.put("defaultReportType", "Неизвестный тип отчёта: "+r.defaultReportType()); }
        if (!errors.isEmpty()) throw new ValidationException("Проверьте настройки ПЭК", "PEK_SETTINGS_VALIDATION_FAILED", errors);
    }

    private static PekSettings defaults(Long companyId) {
        PekSettings s=new PekSettings(); s.setCompanyId(companyId); s.setDefaultReportType(PekSettingsReportType.QUARTERLY);
        s.setAutoCollectProtocols(false); s.setIncludeOnlySignedProtocols(true); s.setAllowFallbackMatching(true);
        s.setRequireManualAmbiguousConfirmation(true); s.setRequireAllPlanFactItems(true);
        s.setBlockSubmitWithUnmatchedResults(true); s.setBlockSubmitWithAmbiguousResults(true);
        s.setBlockSubmitWithStaleSources(true); s.setBlockSubmitWithOpenExceedances(true);
        s.setNotifyBeforeDeadlineDays(7); s.setNotifyMissingProtocols(true); s.setNotifyExceedances(true); s.setNotifyReportReturned(true);
        return s;
    }

    private static void apply(PekSettings s, PekSettingsDtos.UpdateRequest r) {
        s.setDefaultResponsibleUserId(r.defaultResponsibleUserId()); s.setDefaultLaboratoryId(r.defaultLaboratoryId());
        s.setDefaultReportType(PekSettingsReportType.valueOf(r.defaultReportType().trim().toUpperCase()));
        s.setAutoCollectProtocols(Boolean.TRUE.equals(r.autoCollectProtocols()));
        s.setIncludeOnlySignedProtocols(Boolean.TRUE.equals(r.includeOnlySignedProtocols()));
        s.setAllowFallbackMatching(Boolean.TRUE.equals(r.allowFallbackMatching()));
        s.setRequireManualAmbiguousConfirmation(Boolean.TRUE.equals(r.requireManualAmbiguousConfirmation()));
        s.setRequireAllPlanFactItems(Boolean.TRUE.equals(r.requireAllPlanFactItems()));
        s.setBlockSubmitWithUnmatchedResults(Boolean.TRUE.equals(r.blockSubmitWithUnmatchedResults()));
        s.setBlockSubmitWithAmbiguousResults(Boolean.TRUE.equals(r.blockSubmitWithAmbiguousResults()));
        s.setBlockSubmitWithStaleSources(Boolean.TRUE.equals(r.blockSubmitWithStaleSources()));
        s.setBlockSubmitWithOpenExceedances(Boolean.TRUE.equals(r.blockSubmitWithOpenExceedances()));
        s.setNotifyBeforeDeadlineDays(r.notifyBeforeDeadlineDays());
        s.setNotifyMissingProtocols(Boolean.TRUE.equals(r.notifyMissingProtocols())); s.setNotifyExceedances(Boolean.TRUE.equals(r.notifyExceedances()));
        s.setNotifyReportReturned(Boolean.TRUE.equals(r.notifyReportReturned()));
    }

    private PekSettingsDtos.Response toResponse(PekSettings s, User actor, boolean persisted) {
        User responsible=s.getDefaultResponsibleUserId()==null?null:userRepository.findById(s.getDefaultResponsibleUserId()).orElse(null);
        Laboratory lab=s.getDefaultLaboratoryId()==null?null:laboratoryRepository.findById(s.getDefaultLaboratoryId()).orElse(null);
        return new PekSettingsDtos.Response(s.getCompanyId(), s.getDefaultResponsibleUserId(), s.getDefaultLaboratoryId(),
                responsible==null?null:new PekSettingsDtos.UserShort(responsible.getId(), responsible.getName()),
                lab==null?null:new PekSettingsDtos.LaboratoryShort(lab.getId(), lab.getName()), s.getDefaultReportType().name(),
                s.isAutoCollectProtocols(),s.isIncludeOnlySignedProtocols(),s.isAllowFallbackMatching(),s.isRequireManualAmbiguousConfirmation(),
                s.isRequireAllPlanFactItems(),s.isBlockSubmitWithUnmatchedResults(),s.isBlockSubmitWithAmbiguousResults(),
                s.isBlockSubmitWithStaleSources(),s.isBlockSubmitWithOpenExceedances(),s.getNotifyBeforeDeadlineDays(),
                s.isNotifyMissingProtocols(),s.isNotifyExceedances(),s.isNotifyReportReturned(), persisted?s.getVersion():0L,
                Map.of("view",accessService.canViewSettings(actor),"edit",accessService.canEditSettings(actor)),
                Map.of("notificationsSupported",true,"automaticCollectionSupported",true));
    }

    private static String auditValue(PekSettings s) {
        return "reportType="+s.getDefaultReportType()+", signedOnly="+s.isIncludeOnlySignedProtocols()+
                ", fallback="+s.isAllowFallbackMatching()+", readiness=["+s.isRequireAllPlanFactItems()+","+
                s.isBlockSubmitWithUnmatchedResults()+","+s.isBlockSubmitWithAmbiguousResults()+","+
                s.isBlockSubmitWithStaleSources()+","+s.isBlockSubmitWithOpenExceedances()+"]";
    }
}
