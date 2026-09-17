package kz.eco.pek;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekRegulationAdminDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Backend for "Настройка ПЭК" → "Нормативная база" / "Сроки сдачи" (items 1/3/8/9/11 of the PEK
 * settings module fix). Global, not tenant-scoped - see {@link PekSecurityExpressions#PEK_REGULATION_ADMIN}.
 *
 * <p><b>Item 8 (versioning safety):</b> nothing here ever mutates the regulatory content of a row
 * a program/report may already have stamped (code/dates/template versions are set once, at
 * creation, and never rewritten by this service). Publishing a new edition means creating a new
 * row and activating it; historical rows keep whatever they said when a program/report stamped
 * them. Existing APPROVED/ACTIVE programs and every report are read via {@code regulationCode}
 * they already carry - this service never touches {@code PekProgram}/{@code PekReport} rows at
 * all, so activating a new edition cannot retroactively change them (re-template is the only path
 * that moves a program onto a new edition, and it stays restricted to DRAFT/RETURNED - see
 * {@link PekProgramService#retemplate}).
 */
@Service
public class PekRegulationAdminService {

    private static final String REGULATION_ENTITY_TYPE = "PekRegulationVersion";
    private static final String DEADLINE_RULE_ENTITY_TYPE = "PekSubmissionDeadlineRule";
    private static final String TABLE_CONFIG_ENTITY_TYPE = "PekOfficialTableConfig";

    private final PekRegulationVersionRepository regulationRepository;
    private final PekSubmissionDeadlineRuleRepository deadlineRuleRepository;
    private final PekOfficialTableConfigRepository tableConfigRepository;
    private final PekProgramRepository programRepository;
    private final PekReportRepository reportRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public PekRegulationAdminService(PekRegulationVersionRepository regulationRepository,
                                      PekSubmissionDeadlineRuleRepository deadlineRuleRepository,
                                      PekOfficialTableConfigRepository tableConfigRepository,
                                      PekProgramRepository programRepository,
                                      PekReportRepository reportRepository,
                                      UserRepository userRepository,
                                      AuditLogService auditLogService) {
        this.regulationRepository = regulationRepository;
        this.deadlineRuleRepository = deadlineRuleRepository;
        this.tableConfigRepository = tableConfigRepository;
        this.programRepository = programRepository;
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    // ============================================================================================
    // Regulation versions
    // ============================================================================================

    @Transactional(readOnly = true)
    public List<PekRegulationAdminDtos.RegulationVersionResponse> listRegulationVersions() {
        return regulationRepository.findAllByOrderByEffectiveFromDesc().stream().map(this::toResponse).toList();
    }

    /** Item 11: code/templateVersion must never be blank; a duplicate code is refused instead of
     *  silently overwriting the existing edition's content (item 8). New rows are always created
     *  ARCHIVED - {@link #activate} is the only path that makes one current, so "one ACTIVE at a
     *  time" (item 1) has a single enforcement point. */
    @Transactional
    public PekRegulationAdminDtos.RegulationVersionResponse createRegulationVersion(
            PekRegulationAdminDtos.CreateRegulationVersionRequest request, Long userId) {
        requireNotBlank(request.code(), "code");
        requireNotBlank(request.programTemplateVersion(), "programTemplateVersion");
        requireNotBlank(request.reportTemplateVersion(), "reportTemplateVersion");
        requireNotBlank(request.baseOrder(), "baseOrder");
        if (request.effectiveFrom() == null || request.effectiveFrom().isBlank()) {
            throw new BadRequestException("Поле effectiveFrom обязательно", "PEK_REGULATION_EFFECTIVE_FROM_REQUIRED");
        }
        if (regulationRepository.findByCode(request.code()).isPresent()) {
            throw new ConflictException("Версия нормативной базы с кодом " + request.code() + " уже существует",
                    "PEK_REGULATION_CODE_DUPLICATE");
        }
        PekRegulationVersionRow row = new PekRegulationVersionRow();
        row.setCode(request.code());
        row.setTitle(request.title());
        row.setBaseOrder(request.baseOrder());
        row.setRevisionOrder(request.revisionOrder());
        row.setEffectiveFrom(LocalDate.parse(request.effectiveFrom()));
        row.setProgramTemplateVersion(request.programTemplateVersion());
        row.setReportTemplateVersion(request.reportTemplateVersion());
        row.setStatus(PekRegulationVersionStatus.ARCHIVED);
        row.setCreatedBy(userId);
        row.setUpdatedBy(userId);
        regulationRepository.saveAndFlush(row);
        audit(REGULATION_ENTITY_TYPE, row.getId(), userId, "CREATE", null, row.getCode(),
                "Создана версия нормативной базы " + row.getCode());
        return toResponse(row);
    }

    /** Item 1: activating a version archives the current ACTIVE one (if any) in the same
     *  transaction, and closes its effectiveTo the day before this one's effectiveFrom - mirrors
     *  exactly how the old hardcoded {@code ENTRIES} table related its two rows. Item 8: neither
     *  row's identity (code/templateVersion/effectiveFrom) changes - only status/effectiveTo. */
    @Transactional
    public PekRegulationAdminDtos.RegulationVersionResponse activateRegulationVersion(Long id, Long version, Long userId) {
        PekRegulationVersionRow row = regulationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Версия нормативной базы не найдена: " + id));
        checkVersion(row.getVersion(), version, "версии нормативной базы");
        if (row.getStatus() == PekRegulationVersionStatus.ACTIVE) {
            return toResponse(row);
        }
        Optional<PekRegulationVersionRow> currentActive = regulationRepository.findByStatus(PekRegulationVersionStatus.ACTIVE);
        currentActive.ifPresent(prev -> {
            prev.setStatus(PekRegulationVersionStatus.ARCHIVED);
            if (prev.getEffectiveTo() == null) {
                prev.setEffectiveTo(row.getEffectiveFrom().minusDays(1));
            }
            prev.setUpdatedBy(userId);
            prev.setUpdatedAt(LocalDateTime.now());
            regulationRepository.saveAndFlush(prev);
            audit(REGULATION_ENTITY_TYPE, prev.getId(), userId, "ARCHIVE", "ACTIVE", "ARCHIVED",
                    "Автоматически архивирована при активации " + row.getCode());
        });
        row.setStatus(PekRegulationVersionStatus.ACTIVE);
        row.setUpdatedBy(userId);
        row.setUpdatedAt(LocalDateTime.now());
        regulationRepository.saveAndFlush(row);
        audit(REGULATION_ENTITY_TYPE, row.getId(), userId, "ACTIVATE", "ARCHIVED", "ACTIVE",
                "Версия " + row.getCode() + " сделана действующей");
        return toResponse(row);
    }

    @Transactional
    public PekRegulationAdminDtos.RegulationVersionResponse archiveRegulationVersion(Long id, Long version, Long userId) {
        PekRegulationVersionRow row = regulationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Версия нормативной базы не найдена: " + id));
        checkVersion(row.getVersion(), version, "версии нормативной базы");
        if (row.getStatus() == PekRegulationVersionStatus.ARCHIVED) {
            return toResponse(row);
        }
        if (regulationRepository.findAllByOrderByEffectiveFromDesc().stream()
                .filter(r -> r.getStatus() == PekRegulationVersionStatus.ACTIVE).count() <= 1) {
            throw new ConflictException(
                    "Нельзя архивировать единственную действующую версию нормативной базы - сначала активируйте другую",
                    "PEK_REGULATION_LAST_ACTIVE");
        }
        row.setStatus(PekRegulationVersionStatus.ARCHIVED);
        row.setUpdatedBy(userId);
        row.setUpdatedAt(LocalDateTime.now());
        regulationRepository.saveAndFlush(row);
        audit(REGULATION_ENTITY_TYPE, row.getId(), userId, "ARCHIVE", "ACTIVE", "ARCHIVED", null);
        return toResponse(row);
    }

    /** Item 11: a version already stamped on any program or report can never be deleted - it must
     *  stay readable forever for those historical rows (item 8). */
    @Transactional
    public void deleteRegulationVersion(Long id, Long version, Long userId) {
        PekRegulationVersionRow row = regulationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Версия нормативной базы не найдена: " + id));
        checkVersion(row.getVersion(), version, "версии нормативной базы");
        if (row.getStatus() == PekRegulationVersionStatus.ACTIVE) {
            throw new ConflictException("Нельзя удалить действующую версию нормативной базы - сначала активируйте другую",
                    "PEK_REGULATION_DELETE_ACTIVE");
        }
        if (isInUse(row.getCode())) {
            throw new ConflictException(
                    "Версия " + row.getCode() + " уже используется программами или отчётами ПЭК и не может быть удалена",
                    "PEK_REGULATION_IN_USE");
        }
        if (deadlineRuleRepository.existsByRegulationCode(row.getCode())) {
            throw new ConflictException(
                    "Для версии " + row.getCode() + " настроены правила срока сдачи - сначала удалите их",
                    "PEK_REGULATION_HAS_DEADLINE_RULES");
        }
        if (tableConfigRepository.existsByRegulationCode(row.getCode())) {
            throw new ConflictException(
                    "Для версии " + row.getCode() + " настроены официальные таблицы - сначала удалите их",
                    "PEK_REGULATION_HAS_TABLE_CONFIG");
        }
        regulationRepository.delete(row);
        audit(REGULATION_ENTITY_TYPE, row.getId(), userId, "DELETE", row.getCode(), null, null);
    }

    private boolean isInUse(String regulationCode) {
        return programRepository.existsByRegulationCode(regulationCode) || reportRepository.existsByRegulationCode(regulationCode);
    }

    private PekRegulationAdminDtos.RegulationVersionResponse toResponse(PekRegulationVersionRow row) {
        return new PekRegulationAdminDtos.RegulationVersionResponse(
                row.getId(), row.getCode(), row.getTitle(), row.getBaseOrder(), row.getRevisionOrder(),
                row.getEffectiveFrom() == null ? null : row.getEffectiveFrom().toString(),
                row.getEffectiveTo() == null ? null : row.getEffectiveTo().toString(),
                row.getProgramTemplateVersion(), row.getReportTemplateVersion(), row.getStatus().name(),
                row.getVersion(), userName(row.getCreatedBy()), row.getCreatedAt() == null ? null : row.getCreatedAt().toString(),
                userName(row.getUpdatedBy()), row.getUpdatedAt() == null ? null : row.getUpdatedAt().toString(),
                isInUse(row.getCode()));
    }

    // ============================================================================================
    // Submission deadline rules
    // ============================================================================================

    @Transactional(readOnly = true)
    public List<PekRegulationAdminDtos.DeadlineRuleResponse> listDeadlineRules() {
        return deadlineRuleRepository.findAllByOrderByRegulationCodeAscReportTypeAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public PekRegulationAdminDtos.DeadlineRuleResponse createDeadlineRule(
            PekRegulationAdminDtos.CreateDeadlineRuleRequest request, Long userId) {
        requireNotBlank(request.regulationCode(), "regulationCode");
        if (request.reportType() == null || request.reportType().isBlank()) {
            throw new BadRequestException("Поле reportType обязательно", "PEK_DEADLINE_RULE_REPORT_TYPE_REQUIRED");
        }
        PekReportType reportType = parseReportType(request.reportType());
        regulationRepository.findByCode(request.regulationCode())
                .orElseThrow(() -> new BadRequestException(
                        "Неизвестная версия нормативной базы: " + request.regulationCode(), "PEK_REGULATION_NOT_FOUND"));
        if (request.monthsAfterPeriodEnd() == null || request.monthsAfterPeriodEnd() < 0) {
            throw new BadRequestException("Поле monthsAfterPeriodEnd обязательно и должно быть >= 0",
                    "PEK_DEADLINE_RULE_MONTHS_REQUIRED");
        }
        deadlineRuleRepository.findByReportTypeAndRegulationCodeAndActiveTrue(reportType, request.regulationCode())
                .ifPresent(existing -> {
                    throw new ConflictException(
                            "Для " + reportType + " и версии " + request.regulationCode() + " уже есть активное правило срока",
                            "PEK_DEADLINE_RULE_DUPLICATE");
                });
        PekSubmissionDeadlineRuleRow row = new PekSubmissionDeadlineRuleRow();
        row.setReportType(reportType);
        row.setRegulationCode(request.regulationCode());
        row.setMonthsAfterPeriodEnd(request.monthsAfterPeriodEnd());
        row.setDescription(request.description());
        row.setActive(true);
        row.setCreatedBy(userId);
        row.setUpdatedBy(userId);
        deadlineRuleRepository.saveAndFlush(row);
        audit(DEADLINE_RULE_ENTITY_TYPE, row.getId(), userId, "CREATE", null,
                reportType + "/" + request.regulationCode(), "Создано правило срока сдачи");
        return toResponse(row);
    }

    @Transactional
    public PekRegulationAdminDtos.DeadlineRuleResponse updateDeadlineRule(
            Long id, Long version, PekRegulationAdminDtos.UpdateDeadlineRuleRequest request, Long userId) {
        PekSubmissionDeadlineRuleRow row = deadlineRuleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Правило срока сдачи не найдено: " + id));
        checkVersion(row.getVersion(), version, "правила срока сдачи");
        String before = row.getMonthsAfterPeriodEnd() + "/" + row.isActive();
        if (request.monthsAfterPeriodEnd() != null) {
            if (request.monthsAfterPeriodEnd() < 0) {
                throw new BadRequestException("monthsAfterPeriodEnd должно быть >= 0", "PEK_DEADLINE_RULE_MONTHS_INVALID");
            }
            row.setMonthsAfterPeriodEnd(request.monthsAfterPeriodEnd());
        }
        if (request.description() != null) {
            row.setDescription(request.description());
        }
        if (request.active() != null) {
            row.setActive(request.active());
        }
        row.setUpdatedBy(userId);
        row.setUpdatedAt(LocalDateTime.now());
        deadlineRuleRepository.saveAndFlush(row);
        audit(DEADLINE_RULE_ENTITY_TYPE, row.getId(), userId, "UPDATE", before,
                row.getMonthsAfterPeriodEnd() + "/" + row.isActive(), null);
        return toResponse(row);
    }

    private PekRegulationAdminDtos.DeadlineRuleResponse toResponse(PekSubmissionDeadlineRuleRow row) {
        return new PekRegulationAdminDtos.DeadlineRuleResponse(
                row.getId(), row.getReportType().name(), row.getRegulationCode(), row.getMonthsAfterPeriodEnd(),
                row.getDescription(), row.isActive(), row.getVersion(),
                userName(row.getCreatedBy()), row.getCreatedAt() == null ? null : row.getCreatedAt().toString(),
                userName(row.getUpdatedBy()), row.getUpdatedAt() == null ? null : row.getUpdatedAt().toString());
    }

    // ============================================================================================
    // Item 4: official table configuration
    // ============================================================================================

    @Transactional(readOnly = true)
    public List<PekRegulationAdminDtos.OfficialTableConfigResponse> listOfficialTableConfigs(String regulationCode) {
        String code = regulationCode != null ? regulationCode : regulationRepository
                .findByStatus(PekRegulationVersionStatus.ACTIVE).map(PekRegulationVersionRow::getCode)
                .orElseThrow(() -> new BadRequestException(
                        "Не настроена действующая версия нормативной базы - официальные таблицы нельзя перечислить",
                        "PEK_REGULATION_NOT_CONFIGURED"));
        return tableConfigRepository.findByRegulationCodeOrderByDisplayOrderAsc(code).stream().map(this::toResponse).toList();
    }

    /** Item 7: mandatory-ness/applicability here is descriptive metadata for the admin page and
     *  API consumers - it can never switch off an actual readiness check. {@link #updateOfficialTableConfig}
     *  changes only this row, never {@link PekOfficialReportDataService#officialReadinessIssues}'s
     *  own per-row blocking logic. */
    @Transactional
    public PekRegulationAdminDtos.OfficialTableConfigResponse updateOfficialTableConfig(
            Long id, Long version, PekRegulationAdminDtos.UpdateOfficialTableConfigRequest request, Long userId) {
        PekOfficialTableConfigRow row = tableConfigRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Настройка официальной таблицы не найдена: " + id));
        checkVersion(row.getVersion(), version, "настройки официальной таблицы");
        String before = row.isMandatory() + "/" + row.isApplicable() + "/" + row.getDisplayOrder() + "/" + row.getPeriodicity();
        if (request.mandatory() != null) {
            row.setMandatory(request.mandatory());
        }
        if (request.applicable() != null) {
            row.setApplicable(request.applicable());
        }
        if (request.displayOrder() != null) {
            row.setDisplayOrder(request.displayOrder());
        }
        if (request.periodicity() != null && !request.periodicity().isBlank()) {
            row.setPeriodicity(request.periodicity());
        }
        if (request.requiredFields() != null) {
            row.setRequiredFields(String.join(",", request.requiredFields()));
        }
        row.setUpdatedBy(userId);
        row.setUpdatedAt(LocalDateTime.now());
        tableConfigRepository.saveAndFlush(row);
        audit(TABLE_CONFIG_ENTITY_TYPE, row.getId(), userId, "UPDATE", before,
                row.isMandatory() + "/" + row.isApplicable() + "/" + row.getDisplayOrder() + "/" + row.getPeriodicity(), null);
        return toResponse(row);
    }

    private PekRegulationAdminDtos.OfficialTableConfigResponse toResponse(PekOfficialTableConfigRow row) {
        List<String> fields = row.getRequiredFields() == null || row.getRequiredFields().isBlank()
                ? List.of() : List.of(row.getRequiredFields().split(","));
        return new PekRegulationAdminDtos.OfficialTableConfigResponse(
                row.getId(), row.getRegulationCode(), row.getTableType().name(), row.isMandatory(), row.isApplicable(),
                row.getDisplayOrder(), row.getPeriodicity(), fields, row.getVersion(),
                userName(row.getUpdatedBy()), row.getUpdatedAt() == null ? null : row.getUpdatedAt().toString());
    }

    // ============================================================================================
    // Item 5: reference catalogs - single source, exposed read-only so no frontend/module hardcodes
    // its own copy of these lists (they are already defined exactly once in kz.eco.pek - see
    // PekMonitoringType/PekControlType/PekOfficialTableType/PekReportType).
    // ============================================================================================

    @Transactional(readOnly = true)
    public PekRegulationAdminDtos.ReferenceCatalogsResponse referenceCatalogs() {
        return new PekRegulationAdminDtos.ReferenceCatalogsResponse(
                java.util.Arrays.stream(PekMonitoringType.values())
                        .map(v -> new PekRegulationAdminDtos.ReferenceCatalogEntry(v.name(), v.name())).toList(),
                java.util.Arrays.stream(PekControlType.values())
                        .map(v -> new PekRegulationAdminDtos.ReferenceCatalogEntry(v.name(), v.name())).toList(),
                java.util.Arrays.stream(PekOfficialTableType.values())
                        .map(v -> new PekRegulationAdminDtos.ReferenceCatalogEntry(v.name(), v.name())).toList(),
                java.util.Arrays.stream(PekReportType.values())
                        .map(v -> new PekRegulationAdminDtos.ReferenceCatalogEntry(v.name(), v.name())).toList());
    }

    // ============================================================================================
    // Item 6: defaults - what the backend auto-supplies so the frontend never asks the user to pick
    // regulationCode/regulationVersion/templateVersion manually.
    // ============================================================================================

    @Transactional(readOnly = true)
    public PekRegulationAdminDtos.RegulationDefaultsResponse defaults() {
        PekRegulationVersionRow active = regulationRepository.findByStatus(PekRegulationVersionStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException(
                        "Не настроена действующая версия нормативной базы ПЭК - обратитесь к администратору"
                                + " для настройки \"Нормативная база\" перед созданием программ/отчётов",
                        "PEK_REGULATION_NOT_CONFIGURED"));
        List<PekRegulationAdminDtos.OfficialTableConfigResponse> tables = tableConfigRepository
                .findByRegulationCodeOrderByDisplayOrderAsc(active.getCode()).stream().map(this::toResponse).toList();
        return new PekRegulationAdminDtos.RegulationDefaultsResponse(
                active.getCode(), active.getTitle(), active.getProgramTemplateVersion(), active.getReportTemplateVersion(),
                PekReportType.PEK_QUARTERLY.name(), tables);
    }

    // ============================================================================================
    // Shared helpers
    // ============================================================================================

    private static PekReportType parseReportType(String raw) {
        try {
            return PekReportType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Неизвестный тип отчёта: " + raw, "PEK_REPORT_TYPE_UNKNOWN");
        }
    }

    private static void requireNotBlank(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Поле " + field + " обязательно", "PEK_REGULATION_FIELD_REQUIRED");
        }
    }

    private static void checkVersion(Long actual, Long requested, String what) {
        if (requested == null) {
            throw new BadRequestException("Требуется заголовок If-Match с текущей версией " + what, "VERSION_REQUIRED");
        }
        if (!requested.equals(actual)) {
            throw ConflictException.versionConflict("Запись была изменена другим пользователем",
                    "PEK_REGULATION_VERSION_CONFLICT", actual);
        }
    }

    private String userName(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId).map(User::getName).orElse(null);
    }

    private void audit(String entityType, Long entityId, Long userId, String actionType,
                        String oldValue, String newValue, String comment) {
        User actor = userId != null ? userRepository.findById(userId).orElse(null) : null;
        auditLogService.log(entityType, entityId, null, actor, actionType, oldValue, newValue, comment);
    }
}
