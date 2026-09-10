package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.ResourceAccessDeniedException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.PekAccessService;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekMatchStatus;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekMonitoringProtocolTypeResolver;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramIndicator;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.PekReportProtocolSource;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.protocol.dto.ProtocolPekCreationDtos;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * "Create a lab protocol out of the ПЭК programme" (blocker 1).
 *
 * <p>Both endpoints work off the <em>real</em> programme data: the approved/active
 * {@link PekProgram} in force on the requested date, its active monitoring directions, their
 * control items, the frequency configured on each control item, the monitoring points that belong
 * to the direction, the programme indicators of the control item, and the protocols already linked
 * through the canonical link table ({@link PekReportProtocolSource}). Nothing here is mocked or
 * derived from a static list.
 *
 * <p><b>Requirement identity.</b> One "requirement" is one
 * (programme, monitoring direction, control item, monitoring point, reporting period) tuple. It is
 * serialized into a single string ({@link #requirementKey}) which is <em>also</em> stored on the
 * link row and protected by a real unique index (V110). That index - not a find-then-save check -
 * is what makes concurrent creation safe: the losing transaction gets a
 * {@link DataIntegrityViolationException}, which is translated into
 * {@code PROTOCOL_DRAFT_ALREADY_EXISTS} carrying the winner's protocol id.
 */
@Service
public class ProtocolPekCreationService {

    /** Only these programme statuses may be used as the basis for creating a protocol. */
    private static final Set<PekProgramStatus> USABLE_PROGRAM_STATUSES =
            EnumSet.of(PekProgramStatus.ACTIVE, PekProgramStatus.APPROVED);

    /** A protocol counts towards the plan once it has left DRAFT and has not been voided. A DRAFT
     *  is surfaced separately as {@code existingDraftProtocolId} - it is work in progress, not a
     *  fulfilled measurement. */
    private static final Set<ProtocolStatus> VOID_STATUSES = EnumSet.of(
            ProtocolStatus.CANCELLED, ProtocolStatus.ARCHIVED, ProtocolStatus.REPLACED);

    private final PekAccessService accessService;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final PekProgramRepository programRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final ProtocolRepository protocolRepository;
    private final ProtocolTemplateRepository templateRepository;
    private final PekMonitoringProtocolTypeResolver protocolTypeResolver;
    private final LaboratoryRepository laboratoryRepository;
    private final ProtocolService protocolService;
    private final TransactionTemplate transactionTemplate;
    private final TransactionTemplate readOnlyTransactionTemplate;

    public ProtocolPekCreationService(PekAccessService accessService,
                                       CompanyRepository companyRepository,
                                       CompanyObjectRepository companyObjectRepository,
                                       PekProgramRepository programRepository,
                                       PekProgramMonitoringRepository monitoringRepository,
                                       PekProgramControlItemRepository controlItemRepository,
                                       PekMonitoringPointRepository monitoringPointRepository,
                                       PekProgramIndicatorRepository indicatorRepository,
                                       PekReportProtocolSourceRepository sourceRepository,
                                       ProtocolRepository protocolRepository,
                                       ProtocolTemplateRepository templateRepository,
                                       PekMonitoringProtocolTypeResolver protocolTypeResolver,
                                       LaboratoryRepository laboratoryRepository,
                                       ProtocolService protocolService,
                                       TransactionTemplate transactionTemplate) {
        this.accessService = accessService;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.programRepository = programRepository;
        this.monitoringRepository = monitoringRepository;
        this.controlItemRepository = controlItemRepository;
        this.monitoringPointRepository = monitoringPointRepository;
        this.indicatorRepository = indicatorRepository;
        this.sourceRepository = sourceRepository;
        this.protocolRepository = protocolRepository;
        this.templateRepository = templateRepository;
        this.protocolTypeResolver = protocolTypeResolver;
        this.laboratoryRepository = laboratoryRepository;
        this.protocolService = protocolService;
        this.transactionTemplate = transactionTemplate;
        this.readOnlyTransactionTemplate = new TransactionTemplate(transactionTemplate.getTransactionManager());
        this.readOnlyTransactionTemplate.setReadOnly(true);
    }

    // ---------------------------------------------------------------- creation context ---------

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ProtocolPekCreationDtos.CreationContextResponse creationContext(Long companyId, Long objectId,
                                                                            LocalDate date, User user) {
        if (companyId == null) {
            throw new BadRequestException("Укажите companyId", "COMPANY_ID_REQUIRED");
        }
        if (objectId == null) {
            throw new BadRequestException("Укажите objectId", "OBJECT_ID_REQUIRED");
        }
        if (date == null) {
            throw new BadRequestException("Укажите date", "DATE_REQUIRED");
        }
        requireCompanyAccess(user, companyId);
        CompanyObject object = accessService.requireObjectBelongsToCompany(companyId, objectId);
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new NotFoundException("Компания не найдена: " + companyId));

        Period period = Period.of(date);
        Optional<PekProgram> programOpt = findUsableProgram(companyId, objectId, date);
        if (programOpt.isEmpty()) {
            return new ProtocolPekCreationDtos.CreationContextResponse(false,
                    new ProtocolPekCreationDtos.NamedRef(company.getId(), company.getName()),
                    new ProtocolPekCreationDtos.NamedRef(object.getId(), object.getName()),
                    null, period.toDto(), List.of());
        }
        PekProgram program = programOpt.get();
        return new ProtocolPekCreationDtos.CreationContextResponse(true,
                new ProtocolPekCreationDtos.NamedRef(company.getId(), company.getName()),
                new ProtocolPekCreationDtos.NamedRef(object.getId(), object.getName()),
                new ProtocolPekCreationDtos.ProgramRef(program.getId(), program.getNumber(), program.getName()),
                period.toDto(),
                buildRequirements(program, companyId, objectId, period));
    }

    private List<ProtocolPekCreationDtos.Requirement> buildRequirements(PekProgram program, Long companyId,
                                                                        Long objectId, Period period) {
        Map<Long, PekProgramControlItem> itemsById = new HashMap<>();
        for (PekProgramControlItem item : controlItemRepository.findByProgramIdAndActiveTrue(program.getId())) {
            itemsById.put(item.getId(), item);
        }
        Map<Long, List<PekProgramIndicator>> indicatorsByItem = new HashMap<>();
        for (PekProgramIndicator indicator : indicatorRepository.findByProgramIdOrderBySortOrderAsc(program.getId())) {
            indicatorsByItem.computeIfAbsent(indicator.getControlItemId(), k -> new ArrayList<>()).add(indicator);
        }
        LinkState linkState = LinkState.load(sourceRepository, protocolRepository, program.getId(), period);

        List<ProtocolPekCreationDtos.Requirement> result = new ArrayList<>();
        for (PekProgramMonitoring monitoring
                : monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId())) {
            ProtocolTemplate template = resolveDefaultTemplate(monitoring);
            String laboratoryName = laboratoryName(monitoring.getLaboratoryId());
            List<PekMonitoringPoint> allPoints =
                    monitoringPointRepository.findByMonitoringIdOrderByIdAsc(monitoring.getId());

            for (Long controlItemId : monitoring.getControlItemIds()) {
                PekProgramControlItem item = itemsById.get(controlItemId);
                if (item == null) {
                    continue; // inactive or deleted control item - not a live requirement
                }
                List<PekMonitoringPoint> points = pointsFor(item, allPoints);
                List<PekProgramIndicator> indicators =
                        indicatorsByItem.getOrDefault(controlItemId, List.of());
                if (points.isEmpty()) {
                    result.add(requirement(program, companyId, objectId, period, monitoring, item, null,
                            template, laboratoryName, indicators, linkState));
                } else {
                    for (PekMonitoringPoint point : points) {
                        result.add(requirement(program, companyId, objectId, period, monitoring, item, point,
                                template, laboratoryName, indicators, linkState));
                    }
                }
            }
        }
        return result;
    }

    private ProtocolPekCreationDtos.Requirement requirement(PekProgram program, Long companyId, Long objectId,
                                                             Period period, PekProgramMonitoring monitoring,
                                                             PekProgramControlItem item, PekMonitoringPoint point,
                                                             ProtocolTemplate template, String laboratoryName,
                                                             List<PekProgramIndicator> indicators,
                                                             LinkState linkState) {
        String key = requirementKey(program.getId(), monitoring.getId(), item.getId(),
                point == null ? null : point.getId(), period);
        int planCount = plannedCount(item, period);
        LinkState.Counts counts = linkState.countFor(item.getId(), point == null ? null : point.getId());
        int completed = counts.completed();

        ProtocolPekCreationDtos.RequirementStatus status;
        if (template == null || indicators.isEmpty()) {
            status = ProtocolPekCreationDtos.RequirementStatus.CONFIGURATION_REQUIRED;
        } else if (planCount <= 0) {
            status = ProtocolPekCreationDtos.RequirementStatus.NOT_DUE;
        } else if (completed >= planCount) {
            status = ProtocolPekCreationDtos.RequirementStatus.COMPLETED;
        } else if (period.end().isBefore(LocalDate.now())) {
            status = ProtocolPekCreationDtos.RequirementStatus.OVERDUE;
        } else {
            status = ProtocolPekCreationDtos.RequirementStatus.DUE;
        }

        boolean canCreate = (status == ProtocolPekCreationDtos.RequirementStatus.DUE
                || status == ProtocolPekCreationDtos.RequirementStatus.OVERDUE)
                && counts.draftProtocolId() == null;

        List<ProtocolPekCreationDtos.IndicatorInfo> indicatorDtos = indicators.stream()
                .map(i -> new ProtocolPekCreationDtos.IndicatorInfo(i.getId(), i.getIndicatorName(),
                        i.getUnit(), normativeLabel(i)))
                .toList();

        return new ProtocolPekCreationDtos.Requirement(
                key, status.name(), item.getName(), subtitle(monitoring, item),
                frequencyLabel(item.getFrequencyType(), item.getFrequencyValue()),
                planCount, completed, Math.max(0, planCount - completed), canCreate,
                companyId, objectId, program.getId(), monitoring.getId(), item.getId(),
                point == null ? null : point.getId(), point == null ? null : point.getName(),
                template == null ? null : ProtocolTemplateCode.fromDbCode(template.getCode()).toApiId(),
                template == null ? null : template.getName(),
                laboratoryName, counts.draftProtocolId(), indicatorDtos);
    }

    // ---------------------------------------------------------------- create from ПЭК ----------

    /**
     * Deliberately NOT {@code @Transactional} itself: the duplicate-requirement conflict is
     * detected by a DB unique index, and a constraint violation always poisons the transaction it
     * happens in. The whole creation runs in its own transaction via {@link TransactionTemplate};
     * when it fails on the unique index the transaction is rolled back cleanly (no orphan
     * protocol) and only then do we look up the winner to report back.
     */
    public ProtocolApiDtos.ProtocolResponse createFromPek(
            ProtocolPekCreationDtos.CreateProtocolFromPekRequest request, User user) {
        // Validation reads lazy associations (monitoring.controlItemIds), so it needs its own
        // session; it must NOT share the write transaction, which may be poisoned by the unique
        // constraint violation we deliberately provoke below.
        Resolved resolved = readOnlyTransactionTemplate.execute(s -> resolve(request, user));
        try {
            return transactionTemplate.execute(status -> doCreate(resolved, user));
        } catch (DataIntegrityViolationException ex) {
            throw alreadyExists(resolved.requirementKey(), ex);
        }
    }

    private ConflictException alreadyExists(String requirementKey, RuntimeException cause) {
        Long existingProtocolId = sourceRepository.findByRequirementKey(requirementKey)
                .map(PekReportProtocolSource::getProtocolId)
                .orElse(null);
        if (existingProtocolId == null && cause != null) {
            throw cause;
        }
        return new ConflictException(
                "Для этого требования ПЭК уже создан черновик протокола",
                "PROTOCOL_DRAFT_ALREADY_EXISTS", existingProtocolId);
    }

    /** Everything that can be validated without writing anything - runs before the write
     *  transaction so a rejected request never opens one. */
    private Resolved resolve(ProtocolPekCreationDtos.CreateProtocolFromPekRequest request, User user) {
        if (request == null) {
            throw new BadRequestException("Пустой запрос");
        }
        if (request.companyId() == null) {
            throw new BadRequestException("Укажите companyId", "COMPANY_ID_REQUIRED");
        }
        if (request.objectId() == null) {
            throw new BadRequestException("Укажите objectId", "OBJECT_ID_REQUIRED");
        }
        if (request.pekProgramId() == null || request.pekMonitoringId() == null
                || request.pekControlItemId() == null) {
            throw new BadRequestException(
                    "Укажите pekProgramId, pekMonitoringId и pekControlItemId", "PEK_CONTEXT_MISMATCH");
        }
        requireCompanyAccess(user, request.companyId());
        accessService.requireObjectBelongsToCompany(request.companyId(), request.objectId());

        LocalDate date = request.date() == null || request.date().isBlank()
                ? LocalDate.now() : LocalDate.parse(request.date().trim());
        Period period = Period.of(date);

        PekProgram program = programRepository.findById(request.pekProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена", "PEK_PROGRAM_NOT_FOUND"));
        if (!request.companyId().equals(program.getCompanyId())
                || !request.objectId().equals(program.getObjectId())) {
            throw new BadRequestException("Программа ПЭК относится к другой компании или объекту",
                    "PEK_CONTEXT_MISMATCH");
        }
        if (!USABLE_PROGRAM_STATUSES.contains(program.getStatus())
                || !isValidOn(program, date)) {
            throw new ConflictException(
                    "Программа ПЭК не действует на указанную дату (статус: " + program.getStatus() + ")",
                    "PEK_PROGRAM_NOT_ACTIVE");
        }

        PekProgramMonitoring monitoring = monitoringRepository
                .findByIdAndProgramId(request.pekMonitoringId(), program.getId())
                .orElseThrow(() -> new BadRequestException(
                        "Направление мониторинга не относится к указанной программе", "PEK_CONTEXT_MISMATCH"));
        if (!monitoring.isActive()) {
            throw new ConflictException("Направление мониторинга отключено в программе", "PEK_PROGRAM_NOT_ACTIVE");
        }

        PekProgramControlItem item = controlItemRepository.findById(request.pekControlItemId())
                .orElseThrow(() -> new BadRequestException("Контрольная позиция ПЭК не найдена",
                        "PEK_CONTEXT_MISMATCH"));
        if (!program.getId().equals(item.getProgramId())
                || !monitoring.getControlItemIds().contains(item.getId())) {
            throw new BadRequestException(
                    "Контрольная позиция не относится к указанному направлению мониторинга",
                    "PEK_CONTEXT_MISMATCH");
        }
        if (!item.isActive()) {
            throw new ConflictException("Контрольная позиция отключена в программе", "PEK_PROGRAM_NOT_ACTIVE");
        }

        PekMonitoringPoint point = null;
        if (request.monitoringPointId() != null) {
            point = monitoringPointRepository.findByIdAndProgramId(request.monitoringPointId(), program.getId())
                    .orElseThrow(() -> new BadRequestException("Точка мониторинга не относится к программе",
                            "PEK_CONTEXT_MISMATCH"));
            if (!monitoring.getId().equals(point.getMonitoringId())) {
                throw new BadRequestException("Точка мониторинга относится к другому направлению",
                        "PEK_CONTEXT_MISMATCH");
            }
            if (item.getMonitoringPointId() != null && !item.getMonitoringPointId().equals(point.getId())) {
                throw new BadRequestException("Точка мониторинга не относится к контрольной позиции",
                        "PEK_CONTEXT_MISMATCH");
            }
        }

        List<PekProgramIndicator> indicators =
                indicatorRepository.findByControlItemIdOrderBySortOrderAsc(item.getId());
        if (indicators.isEmpty()) {
            throw new ConflictException(
                    "Для контрольной позиции не настроены показатели - создание протокола невозможно",
                    "CONFIGURATION_REQUIRED");
        }
        Long programIndicatorId = request.programIndicatorId();
        if (programIndicatorId != null) {
            Long pinned = programIndicatorId;
            if (indicators.stream().noneMatch(i -> i.getId().equals(pinned))) {
                throw new BadRequestException("Показатель не относится к указанной контрольной позиции",
                        "PEK_CONTEXT_MISMATCH");
            }
        }

        ProtocolTemplate template = resolveRequestedTemplate(monitoring, request.protocolTemplateId());

        int planCount = plannedCount(item, period);
        if (planCount <= 0) {
            throw new ConflictException(
                    "На выбранный период по этой позиции не запланированы измерения",
                    "PROTOCOL_PLAN_ALREADY_COMPLETED");
        }
        LinkState linkState = LinkState.load(sourceRepository, protocolRepository, program.getId(), period);
        LinkState.Counts counts = linkState.countFor(item.getId(), point == null ? null : point.getId());
        if (counts.completed() >= planCount) {
            throw new ConflictException("План по этому требованию ПЭК уже выполнен",
                    "PROTOCOL_PLAN_ALREADY_COMPLETED");
        }

        String key = requirementKey(program.getId(), monitoring.getId(), item.getId(),
                point == null ? null : point.getId(), period);
        // Cheap pre-check; the unique index below is the real guarantee.
        Optional<PekReportProtocolSource> existing = sourceRepository.findByRequirementKey(key);
        if (existing.isPresent()) {
            throw alreadyExists(key, null);
        }
        return new Resolved(program, monitoring, item, point, template, programIndicatorId, period, key, date);
    }

    private ProtocolApiDtos.ProtocolResponse doCreate(Resolved r, User user) {
        var pekContext = new ProtocolApiDtos.ProtocolPekContextRequest(
                r.program().getId(), null, r.item().getId(), r.programIndicatorId(), null,
                r.point() == null ? null : r.point().getId(), null, null, null);
        var draftRequest = new ProtocolApiDtos.CreateProtocolDraftRequest(
                ProtocolTemplateCode.fromDbCode(r.template().getCode()).toApiId(), null,
                r.program().getCompanyId(), r.program().getObjectId(),
                r.date().toString(), r.date().toString(),
                r.monitoring().getLaboratoryId(), null, null, null, null, null, null, null,
                // The canonical PEK link is written explicitly below (it must carry the
                // requirementKey that guards against duplicates), so createDraft must not create a
                // second, competing link of its own.
                null,
                r.point() == null ? null : r.point().getName());

        ProtocolApiDtos.ProtocolResponse response = protocolService.createDraft(draftRequest, user.getId());
        Long protocolId = Long.parseLong(response.id());

        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден: " + protocolId));
        // Legacy denormalized convenience columns on Protocol - kept in sync, but the canonical
        // link is the PekReportProtocolSource row created below (see its class javadoc).
        protocol.setPekProgramId(r.program().getId());
        protocol.setPekControlItemId(r.item().getId());
        if (r.point() != null) {
            // The ПЭК monitoring point IS the protocol's sampling/measurement place - filling it in
            // here is what makes the generated draft immediately usable (and satisfies the
            // per-type header validation, e.g. AmbientAirValidationPolicy's MEASUREMENT_PLACE_REQUIRED).
            protocol.setSamplingLocationSnapshot(r.point().getName());
        }
        protocolRepository.saveAndFlush(protocol);

        PekReportProtocolSource link = new PekReportProtocolSource();
        link.setProtocolId(protocolId);
        link.setProgramId(r.program().getId());
        link.setControlItemId(r.item().getId());
        link.setProgramIndicatorId(r.programIndicatorId());
        link.setMonitoringPointId(r.point() == null ? null : r.point().getId());
        link.setRequirementKey(r.requirementKey());
        link.setManual(true);
        link.setMatchType("MANUAL");
        link.setMatchStatus(PekMatchStatus.MATCHED);
        link.setMatchedBy(user.getId());
        link.setMatchedAt(LocalDateTime.now());
        link.setSourceVersion(protocol.getVersion());
        link.setMatchReason("Протокол создан из требования ПЭК " + r.requirementKey());
        // saveAndFlush, not save: the unique index on requirement_key must be evaluated here, while
        // we can still translate the violation, not at an opaque commit-time flush.
        sourceRepository.saveAndFlush(link);

        return protocolService.get(protocolId);
    }

    // ---------------------------------------------------------------- helpers ------------------

    private void requireCompanyAccess(User user, Long companyId) {
        UserRole role = user == null ? null : user.getRole();
        try {
            accessService.requireCompanyAccess(user == null ? null : user.getId(), role, companyId);
        } catch (org.springframework.security.access.AccessDeniedException ex) {
            throw new ResourceAccessDeniedException("Нет доступа к данным ПЭК этой компании");
        }
    }

    private Optional<PekProgram> findUsableProgram(Long companyId, Long objectId, LocalDate date) {
        List<PekProgram> candidates =
                programRepository.findByCompanyIdAndObjectIdOrderByValidFromDesc(companyId, objectId);
        // ACTIVE wins over merely APPROVED when both cover the date - an activated programme is
        // the one actually in force.
        return candidates.stream()
                .filter(p -> p.getStatus() == PekProgramStatus.ACTIVE && isValidOn(p, date))
                .findFirst()
                .or(() -> candidates.stream()
                        .filter(p -> p.getStatus() == PekProgramStatus.APPROVED && isValidOn(p, date))
                        .findFirst());
    }

    private static boolean isValidOn(PekProgram program, LocalDate date) {
        return (program.getValidFrom() == null || !date.isBefore(program.getValidFrom()))
                && (program.getValidUntil() == null || !date.isAfter(program.getValidUntil()));
    }

    private List<PekMonitoringPoint> pointsFor(PekProgramControlItem item, List<PekMonitoringPoint> allPoints) {
        if (item.getMonitoringPointId() == null) {
            return allPoints;
        }
        return allPoints.stream().filter(p -> p.getId().equals(item.getMonitoringPointId())).toList();
    }

    private ProtocolTemplate resolveDefaultTemplate(PekProgramMonitoring monitoring) {
        List<ProtocolTemplateCode> codes = protocolTypeResolver.resolve(monitoring.getMonitoringType());
        if (codes.isEmpty()) {
            return null;
        }
        return templateRepository.findByCode(codes.get(0).name()).orElse(null);
    }

    private ProtocolTemplate resolveRequestedTemplate(PekProgramMonitoring monitoring, String requestedId) {
        List<ProtocolTemplateCode> allowed = protocolTypeResolver.resolve(monitoring.getMonitoringType());
        if (allowed.isEmpty()) {
            throw new ConflictException(
                    "Для этого направления мониторинга не предусмотрен шаблон протокола",
                    "CONFIGURATION_REQUIRED");
        }
        ProtocolTemplateCode code;
        if (requestedId == null || requestedId.isBlank()) {
            code = allowed.get(0);
        } else {
            code = ProtocolTemplateCode.fromCode(requestedId);
            if (!allowed.contains(code)) {
                throw new BadRequestException(
                        "Шаблон протокола не соответствует направлению мониторинга", "PEK_CONTEXT_MISMATCH");
            }
        }
        return templateRepository.findByCode(code.name())
                .orElseThrow(() -> new ConflictException(
                        "Шаблон протокола не настроен: " + code.name(), "CONFIGURATION_REQUIRED"));
    }

    private String laboratoryName(Long laboratoryId) {
        if (laboratoryId == null) {
            return null;
        }
        return laboratoryRepository.findById(laboratoryId).map(l -> l.getName()).orElse(null);
    }

    private static int plannedCount(PekProgramControlItem item, Period period) {
        if (item.getStartDate() != null && item.getStartDate().isAfter(period.end())) {
            return 0;
        }
        if (item.getEndDate() != null && item.getEndDate().isBefore(period.start())) {
            return 0;
        }
        return kz.eco.pek.PekFrequencyCalculator.plannedOccurrences(item.getFrequencyType(), item.getFrequencyValue(),
                item.getPlannedCount(), period.start(), period.end());
    }

    static String requirementKey(Long programId, Long monitoringId, Long controlItemId, Long pointId, Period period) {
        return "program:" + programId
                + "|monitoring:" + monitoringId
                + "|item:" + controlItemId
                + "|point:" + (pointId == null ? "-" : pointId)
                + "|period:" + period.year() + "-Q" + period.quarter();
    }

    private static String subtitle(PekProgramMonitoring monitoring, PekProgramControlItem item) {
        String direction = monitoring.getName() != null && !monitoring.getName().isBlank()
                ? monitoring.getName() : String.valueOf(monitoring.getMonitoringType());
        return item.getEnvironmentComponent() != null && !item.getEnvironmentComponent().isBlank()
                ? direction + " - " + item.getEnvironmentComponent()
                : direction;
    }

    private static String frequencyLabel(PekFrequencyType type, int value) {
        if (type == null) {
            return null;
        }
        String base = switch (type) {
            case DAILY -> "Ежедневно";
            case WEEKLY -> "Еженедельно";
            case MONTHLY -> "Ежемесячно";
            case QUARTERLY -> "Ежеквартально";
            case SEMIANNUAL -> "Раз в полугодие";
            case ANNUAL -> "Ежегодно";
            case PER_EVENT -> "По событию";
        };
        return value > 1 ? base + " x" + value : base;
    }

    private static String normativeLabel(PekProgramIndicator indicator) {
        BigDecimal value = indicator.getNormativeValue();
        String unit = indicator.getUnit() == null ? "" : " " + indicator.getUnit();
        if (indicator.getComparisonType() == null) {
            return value == null ? null : value.toPlainString() + unit;
        }
        return switch (indicator.getComparisonType()) {
            case LESS_OR_EQUAL -> value == null ? null : "не более " + value.toPlainString() + unit;
            case GREATER_OR_EQUAL -> value == null ? null : "не менее " + value.toPlainString() + unit;
            case RANGE, BETWEEN -> indicator.getMinValue() == null || indicator.getMaxValue() == null ? null
                    : "от " + indicator.getMinValue().toPlainString()
                            + " до " + indicator.getMaxValue().toPlainString() + unit;
            case EQUAL -> value == null ? null : value.toPlainString() + unit;
            case ABSENT -> "отсутствие";
            case INFO -> null;
        };
    }

    // ---------------------------------------------------------------- inner types --------------

    /** The reporting quarter containing a date - the period every requirement is evaluated in. */
    record Period(int year, int quarter, LocalDate start, LocalDate end) {
        static Period of(LocalDate date) {
            int q = (date.getMonthValue() - 1) / 3 + 1;
            LocalDate start = LocalDate.of(date.getYear(), (q - 1) * 3 + 1, 1);
            return new Period(date.getYear(), q, start, start.plusMonths(3).minusDays(1));
        }

        ProtocolPekCreationDtos.PeriodInfo toDto() {
            String label = switch (quarter) {
                case 1 -> "I квартал ";
                case 2 -> "II квартал ";
                case 3 -> "III квартал ";
                default -> "IV квартал ";
            } + year;
            return new ProtocolPekCreationDtos.PeriodInfo(label, year, quarter, start.toString(), end.toString());
        }
    }

    private record Resolved(PekProgram program, PekProgramMonitoring monitoring, PekProgramControlItem item,
                             PekMonitoringPoint point, ProtocolTemplate template, Long programIndicatorId,
                             Period period, String requirementKey, LocalDate date) {}

    /**
     * All canonical links of one programme, bucketed by (control item, monitoring point) and
     * filtered down to the protocols that actually fall inside the period. Loaded once per request
     * so a programme with many requirements does not issue one query per requirement.
     */
    private record LinkState(Map<String, Counts> byBucket) {

        record Counts(int completed, Long draftProtocolId) {}

        private static final Counts EMPTY = new Counts(0, null);

        static LinkState load(PekReportProtocolSourceRepository sources, ProtocolRepository protocols,
                               Long programId, Period period) {
            List<PekReportProtocolSource> links = sources.findByProgramIdAndExcludedFalseOrderByIdAsc(programId);
            Map<Long, Protocol> protocolsById = new HashMap<>();
            List<Long> ids = links.stream().map(PekReportProtocolSource::getProtocolId)
                    .filter(java.util.Objects::nonNull).distinct().toList();
            for (Protocol p : protocols.findAllById(ids)) {
                protocolsById.put(p.getId(), p);
            }
            Map<String, Integer> completed = new HashMap<>();
            Map<String, Long> drafts = new HashMap<>();
            for (PekReportProtocolSource link : links) {
                if (link.getControlItemId() == null || link.getProtocolResultId() != null) {
                    continue; // only whole-protocol links describe a fulfilled requirement
                }
                Protocol p = protocolsById.get(link.getProtocolId());
                if (p == null || p.getDeletedAt() != null) {
                    continue;
                }
                LocalDate date = p.getProtocolDate();
                if (date == null || date.isBefore(period.start()) || date.isAfter(period.end())) {
                    continue;
                }
                if (VOID_STATUSES.contains(p.getStatus())) {
                    continue;
                }
                String bucket = bucket(link.getControlItemId(), link.getMonitoringPointId());
                if (p.getStatus() == ProtocolStatus.DRAFT) {
                    drafts.putIfAbsent(bucket, p.getId());
                } else {
                    completed.merge(bucket, 1, Integer::sum);
                }
            }
            Map<String, Counts> merged = new LinkedHashMap<>();
            for (String bucket : completed.keySet()) {
                merged.put(bucket, new Counts(completed.get(bucket), drafts.get(bucket)));
            }
            for (Map.Entry<String, Long> e : drafts.entrySet()) {
                merged.computeIfAbsent(e.getKey(), k -> new Counts(0, e.getValue()));
            }
            return new LinkState(merged);
        }

        Counts countFor(Long controlItemId, Long pointId) {
            return byBucket.getOrDefault(bucket(controlItemId, pointId), EMPTY);
        }

        private static String bucket(Long controlItemId, Long pointId) {
            return controlItemId + "/" + (pointId == null ? "-" : pointId);
        }
    }

}
