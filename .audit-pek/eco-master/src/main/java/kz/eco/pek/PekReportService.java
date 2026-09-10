package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.auth.CurrentUser;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.common.PageResponse;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class PekReportService {

    private final PekReportRepository reportRepository;
    private final PekProgramRepository programRepository;
    private final PekProgramService programService;
    private final PekReportCollectionService collectionService;
    private final PekAutoCollectionService autoCollectionService;
    private final PekPlanFactService planFactService;
    private final PekReportPlanFactRowRepository planFactRowRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final ProtocolRepository protocolRepository;
    private final ProtocolResultRepository protocolResultRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final PekAccessService accessService;
    private final UserRepository userRepository;
    private final PekReportReadinessService readinessService;
    private final PekSettingsService settingsService;
    private final PekReportWorkflowGuard workflowGuard;
    private final PekReportWorkflowHistoryRepository historyRepository;
    private final PekProtocolEligibilityService eligibilityService;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekReportDocumentVersionRepository documentVersionRepository;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekSubmissionDeadlineService deadlineService;

    public PekReportService(PekReportRepository reportRepository, PekProgramRepository programRepository,
                            PekProgramService programService, PekReportCollectionService collectionService,
                            PekAutoCollectionService autoCollectionService,
                            PekPlanFactService planFactService, PekReportPlanFactRowRepository planFactRowRepository,
                            PekProgramControlItemRepository controlItemRepository, PekProgramIndicatorRepository indicatorRepository,
                            PekReportProtocolSourceRepository sourceRepository, ProtocolRepository protocolRepository,
                            ProtocolResultRepository protocolResultRepository,
                            CompanyRepository companyRepository, CompanyObjectRepository companyObjectRepository,
                            PekAccessService accessService, UserRepository userRepository,
                            PekReportReadinessService readinessService, PekSettingsService settingsService,
                            PekReportWorkflowGuard workflowGuard,
                            PekReportWorkflowHistoryRepository historyRepository,
                            PekProtocolEligibilityService eligibilityService,
                            PekReportExceedanceRepository exceedanceRepository,
                            PekReportDocumentVersionRepository documentVersionRepository,
                            PekReportContentRevisionService contentRevisionService,
                            PekSubmissionDeadlineService deadlineService) {
        this.reportRepository = reportRepository;
        this.programRepository = programRepository;
        this.programService = programService;
        this.collectionService = collectionService;
        this.autoCollectionService = autoCollectionService;
        this.planFactService = planFactService;
        this.planFactRowRepository = planFactRowRepository;
        this.controlItemRepository = controlItemRepository;
        this.indicatorRepository = indicatorRepository;
        this.sourceRepository = sourceRepository;
        this.protocolRepository = protocolRepository;
        this.protocolResultRepository = protocolResultRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.accessService = accessService;
        this.userRepository = userRepository;
        this.readinessService = readinessService;
        this.settingsService = settingsService;
        this.workflowGuard = workflowGuard;
        this.historyRepository = historyRepository;
        this.eligibilityService = eligibilityService;
        this.exceedanceRepository = exceedanceRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.contentRevisionService = contentRevisionService;
        this.deadlineService = deadlineService;
    }

    /**
     * Shape matches the frontend contract exactly: company/object as short DTOs (never bare ids),
     * "programs" (not "activePrograms"), "selectedProgramId" (not "autoSelectedProgramId"),
     * "duplicateReportId" as the actual conflicting report's id, not a bare boolean, plus a
     * separate non-blocking "warnings" list distinct from "blockingReasons".
     */
    @Transactional(readOnly = true)
    public PekApiDtos.ReportCreationContext creationContext(Long companyId, Long objectId, String periodTypeRaw,
                                                             Integer year, Integer quarter) {
        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        CompanyObject object = validateObject(companyId, objectId, blockers);
        PekApiDtos.CompanyShortDto companyDto = object != null
                ? companyRepository.findById(companyId)
                        .map(c -> new PekApiDtos.CompanyShortDto(c.getId(), c.getName(), c.getBin()))
                        .orElse(null)
                : null;
        PekApiDtos.CompanyObjectShortDto objectDto = object != null
                ? new PekApiDtos.CompanyObjectShortDto(object.getId(), object.getName())
                : null;

        PekPeriodType periodType = parsePeriodType(periodTypeRaw, blockers);
        LocalDate[] bounds = null;
        if (periodType != null && year != null) {
            try {
                bounds = periodType.boundsFor(year, quarter);
            } catch (BadRequestException e) {
                blockers.add(e.getMessage());
            }
        } else if (year == null) {
            blockers.add("Укажите year");
        }

        List<PekProgram> active = object != null
                ? programService.findActiveForObject(companyId, object.getId())
                : List.of();
        List<PekApiDtos.ProgramResponse> activeResponses = active.stream()
                .map(programService::toResponse)
                .toList();
        Long selectedProgramId = active.size() == 1 ? active.get(0).getId() : null;
        if (object != null && active.isEmpty()) {
            blockers.add("На объекте нет действующей программы ПЭК");
        } else if (active.size() > 1) {
            warnings.add("На объекте несколько действующих программ ПЭК - выберите programId явно");
        }
        // Task 2: an ACTIVE program that simply doesn't cover this report's period must block
        // creation just as loudly as "no active program at all" - otherwise the single-active-
        // program auto-select path would silently attach a Q3 report to a program only valid
        // through Q1.
        if (selectedProgramId != null && bounds != null) {
            PekProgram candidate = active.get(0);
            if (!programService.coversPeriod(candidate, bounds[0], bounds[1])) {
                blockers.add("Программа ПЭК действует с " + candidate.getValidFrom() + " по "
                        + candidate.getValidUntil() + " и не покрывает выбранный период отчёта");
            }
        }

        Long duplicateReportId = null;
        if (object != null && periodType != null && year != null && selectedProgramId != null) {
            String periodKey = periodKeyOf(periodType, year, quarter);
            duplicateReportId = reportRepository.findByObjectIdAndProgramIdAndPeriodKey(
                            object.getId(), selectedProgramId, periodKey)
                    .map(PekReport::getId)
                    .orElse(null);
            if (duplicateReportId != null) {
                blockers.add("Отчёт за этот период уже создан");
            }
        }

        return new PekApiDtos.ReportCreationContext(
                companyDto, objectDto,
                bounds != null ? bounds[0].toString() : null, bounds != null ? bounds[1].toString() : null,
                activeResponses, selectedProgramId, duplicateReportId, warnings, blockers);
    }

    @Transactional
    public PekApiDtos.ReportResponse create(PekApiDtos.CreateReportRequest request, Long userId) {
        List<String> blockers = new ArrayList<>();
        CompanyObject object = validateObject(request.companyId(), request.objectId(), blockers);
        if (!blockers.isEmpty()) {
            throw new BadRequestException(blockers.get(0));
        }
        PekPeriodType periodType = request.periodType() == null || request.periodType().isBlank()
                ? settingsService.defaultPeriodType(request.companyId()) : parsePeriodTypeOrThrow(request.periodType());
        if (request.year() == null) {
            throw new BadRequestException("Укажите year");
        }
        LocalDate[] bounds = periodType.boundsFor(request.year(), request.quarter());

        Long programId = request.programId();
        if (programId == null) {
            List<PekProgram> active = programService.findActiveForObject(request.companyId(), object.getId());
            if (active.isEmpty()) {
                throw new BadRequestException("На объекте нет действующей программы ПЭК. Сначала активируйте программу.",
                        "PEK_ACTIVE_PROGRAM_MISSING");
            }
            if (active.size() > 1) {
                throw new BadRequestException("На объекте несколько действующих программ ПЭК - укажите programId явно");
            }
            programId = active.get(0).getId();
        }
        PekProgram program = programService.getOrThrow(programId);
        if (program.getStatus() != PekProgramStatus.ACTIVE) {
            throw new BadRequestException("Программа ПЭК не активна", "PEK_ACTIVE_PROGRAM_MISSING");
        }
        // Task 5: same check as before, now centralized in PekAccessService instead of an inline
        // copy (see PekAccessService javadoc for what this does and does not change).
        accessService.requireProgramBelongsTo(program, request.companyId(), object.getId());
        if (!programService.coversPeriod(program, bounds[0], bounds[1])) {
            throw new BadRequestException("Программа ПЭК действует с " + program.getValidFrom() + " по "
                    + program.getValidUntil() + " и не покрывает выбранный период отчёта",
                    "PEK_PROGRAM_PERIOD_MISMATCH");
        }

        Integer quarterKey = periodType == PekPeriodType.YEAR ? null : request.quarter();
        String periodKey = periodKeyOf(periodType, request.year(), quarterKey);
        if (reportRepository.findByObjectIdAndProgramIdAndPeriodKey(
                object.getId(), program.getId(), periodKey).isPresent()) {
            throw new ConflictException("Отчёт за этот период уже создан", "PEK_REPORT_DUPLICATE");
        }

        PekReport report = new PekReport();
        report.setCompanyId(request.companyId());
        report.setObjectId(object.getId());
        report.setProgramId(program.getId());
        report.setPeriodType(periodType);
        report.setReportYear(request.year());
        report.setReportQuarter(quarterKey);
        report.setPeriodStart(bounds[0]);
        report.setPeriodEnd(bounds[1]);
        report.setStatus(PekReportStatus.DRAFT);
        Long configuredResponsible = settingsService.defaultResponsibleUserId(request.companyId());
        report.setResponsibleUserId(configuredResponsible != null ? configuredResponsible : userId);
        report.setCreatedBy(userId);
        // Stamp regulation/template versions from the program - immutable per report from this
        // point forward, even if the program is later superseded or re-templated.
        report.setRegulationVersion(program.getRegulationVersion());
        report.setRegulationCode(program.getRegulationCode());
        report.setTemplateVersion(program.getTemplateVersion());
        // Submission deadline resolved from (reportType, regulationCode) via the rule table -
        // authoritative source of truth for scheduler, dashboard, and notifications (never
        // periodEnd directly, always submissionDueDate).
        //
        // The type comes from the period AND the facility: an annual period is the Caspian ПЭМ
        // report only for a facility explicitly marked CASPIAN_MARINE, and otherwise the annual
        // tables 7/12 submission. periodType alone cannot tell those apart, and guessing from
        // coordinates or КАТО would move a statutory deadline on a boundary this system invented.
        report.setReportType(PekReportType.classify(periodType, object.getSpecialMonitoringType()));
        report.setSubmissionDueDate(deadlineService.calculateFor(
                report.getReportType(), object.getSpecialMonitoringType(),
                report.getRegulationCode(), bounds[1]));
        report.computePeriodKey();
        try {
            reportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Отчёт за этот период уже создан", "PEK_REPORT_DUPLICATE");
        }

        recordHistory(report, null, "CREATE", null, userId, null);
        if (Boolean.TRUE.equals(request.collectImmediately())) {
            autoCollectionService.collectWithChangeDetection(report, userId, "COLLECT");
            reportRepository.saveAndFlush(report);
        }
        return toResponse(report);
    }

    private static String periodKeyOf(PekPeriodType periodType, Integer year, Integer quarter) {
        return periodType == PekPeriodType.YEAR ? year + "-YEAR" : year + "-Q" + quarter;
    }

    @Transactional
    public PekApiDtos.CollectionResult collect(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        User collectActor = CurrentUser.get();
        accessService.requireCompanyEditPermission(collectActor.getId(), collectActor.getRole(), report.getCompanyId());
        PekApiDtos.CollectionResult result = autoCollectionService.collectWithChangeDetection(
                report, collectActor.getId(), "COLLECT");
        reportRepository.saveAndFlush(report);
        return new PekApiDtos.CollectionResult(toResponse(report), result.linkedProtocolCount(), result.linkedProtocolNumbers(),
                result.protocolResultCount(), result.matchedCount(), result.unmatchedCount(), result.ambiguousCount(),
                result.removedStaleSourceCount(), result.updatedSourceCount(), result.warnings());
    }

    /** GET /api/pek/reports/{id}/sources (additive endpoint, see module report's API-changes
     *  section for why this was added rather than folding sources into ReportResponse: a report can
     *  have hundreds of per-result source rows once collect() stops skipping UNMATCHED/AMBIGUOUS
     *  results, which does not belong inlined into every GET /reports/{id} response). Every filter
     *  optional - an unfiltered call returns the report's full reconciliation detail. */
    @Transactional(readOnly = true)
    public List<PekApiDtos.ReportSourceItem> getSources(Long id, String matchStatusRaw, Long protocolId,
                                                          Boolean excluded, Boolean manual) {
        PekReport report = getOrThrow(id);
        PekMatchStatus matchStatus = null;
        if (matchStatusRaw != null && !matchStatusRaw.isBlank()) {
            try {
                matchStatus = PekMatchStatus.valueOf(matchStatusRaw.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Некорректный matchStatus: " + matchStatusRaw);
            }
        }
        List<PekReportProtocolSource> sources = sourceRepository.search(report.getId(), matchStatus, protocolId, excluded, manual);
        java.util.Map<Long, kz.eco.protocol.Protocol> protocolsById = new java.util.HashMap<>();
        protocolRepository.findAllById(sources.stream().map(PekReportProtocolSource::getProtocolId).distinct().toList())
                .forEach(p -> protocolsById.put(p.getId(), p));
        java.util.Map<Long, PekProgramIndicator> indicatorsById = new java.util.HashMap<>();
        indicatorRepository.findAllById(sources.stream().map(PekReportProtocolSource::getProgramIndicatorId)
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(ind -> indicatorsById.put(ind.getId(), ind));
        java.util.Map<Long, kz.eco.protocol.ProtocolResult> resultsById = new java.util.HashMap<>();
        protocolResultRepository.findAllById(sources.stream().map(PekReportProtocolSource::getProtocolResultId)
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(result -> resultsById.put(result.getId(), result));
        java.util.Map<Long, PekProgramControlItem> controlItemsById = new java.util.HashMap<>();
        controlItemRepository.findAllById(sources.stream().map(PekReportProtocolSource::getControlItemId)
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(item -> controlItemsById.put(item.getId(), item));

        return sources.stream().map(s -> {
            PekProgramIndicator indicator = s.getProgramIndicatorId() != null ? indicatorsById.get(s.getProgramIndicatorId()) : null;
            kz.eco.protocol.Protocol protocol = protocolsById.get(s.getProtocolId());
            kz.eco.protocol.ProtocolResult result = s.getProtocolResultId() == null ? null : resultsById.get(s.getProtocolResultId());
            PekProgramControlItem controlItem = s.getControlItemId() == null ? null : controlItemsById.get(s.getControlItemId());
            return new PekApiDtos.ReportSourceItem(
                    s.getId(), s.getProtocolId(), protocol == null ? null : protocol.getProtocolNumber(), s.getProtocolResultId(),
                    result != null ? result.getIndicatorName() : indicator != null ? indicator.getIndicatorName() : null,
                    result != null ? result.getUnit() : indicator != null ? indicator.getUnit() : null,
                    s.getControlItemId(), s.getProgramIndicatorId(), s.getMatchStatus().name(), s.getMatchType(),
                    s.isManual(), s.isExcluded(), s.getExclusionReason(), s.getSourceVersion(), s.getVersion(),
                    s.getMatchReason(), s.getMatchedAt() != null ? s.getMatchedAt().toString() : null,
                    s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : null,
                    protocol == null || protocol.getProtocolDate() == null ? null : protocol.getProtocolDate().toString(),
                    protocol == null || protocol.getStatus() == null ? null : protocol.getStatus().name(),
                    result == null ? null : result.getPollutantCode(), result == null ? null : result.getResultValue(),
                    result == null ? null : result.getNote(), result == null ? null : result.getNormativeValue(),
                    result == null || result.getComparisonType() == null ? null : result.getComparisonType().name(),
                    result == null ? null : result.getInternalStatus() == kz.eco.protocol.ResultInternalStatus.EXCEEDED,
                    result == null ? null : result.getSamplingPlace(),
                    result == null || result.getSampleDate() == null ? null : result.getSampleDate().toString(),
                    result == null ? null : result.getTestingMethodNd(), protocol == null ? null : protocol.getLaboratoryName(),
                    controlItem == null ? null : controlItem.getName(), indicator == null ? null : indicator.getIndicatorName(),
                    s.getCreatedAt() == null ? null : s.getCreatedAt().toString());
        }).toList();
    }

    @Transactional(readOnly = true)
    public PekApiDtos.SourceSummary sourceSummary(Long id) {
        PekReport report = getOrThrow(id);
        return new PekApiDtos.SourceSummary(sourceRepository.countDistinctProtocolsByReportId(report.getId()),
                sourceRepository.countByReportIdAndProtocolResultIdIsNotNullAndExcludedFalse(report.getId()),
                sourceRepository.countByReportIdAndMatchStatusAndExcludedFalse(report.getId(), PekMatchStatus.UNMATCHED),
                sourceRepository.countByReportIdAndMatchStatusAndExcludedFalse(report.getId(), PekMatchStatus.AMBIGUOUS),
                sourceRepository.countByReportIdAndMatchStatusAndExcludedFalse(report.getId(), PekMatchStatus.STALE),
                sourceRepository.countByReportIdAndExcludedTrue(report.getId()));
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ReadinessResponse readiness(Long id) { return readinessService.evaluate(getOrThrow(id)); }

    @Transactional
    public PekApiDtos.ReportSourceItem matchSource(Long reportId, Long sourceId, PekApiDtos.MatchSourceRequest request, Long version) {
        PekReport report = getOrThrow(reportId);
        User matchActor = CurrentUser.get();
        accessService.requireCompanyEditPermission(matchActor.getId(), matchActor.getRole(), report.getCompanyId());
        workflowGuard.requireEditable(report);
        PekReportProtocolSource source = sourceForReport(reportId, sourceId);
        checkSourceVersion(source, version);
        eligibilityService.requireEligible(report, protocolRepository.findById(source.getProtocolId())
                .orElseThrow(() -> new NotFoundException("Протокол не найден")), false);
        PekProgramIndicator indicator = indicatorRepository.findById(request.indicatorId())
                .orElseThrow(() -> new NotFoundException("Показатель ПЭК не найден: " + request.indicatorId()));
        if (!indicator.getProgramId().equals(report.getProgramId()))
            throw new BadRequestException("Показатель относится к другой программе", "PEK_SOURCE_INDICATOR_SCOPE");
        source.setProgramIndicatorId(indicator.getId());
        source.setControlItemId(indicator.getControlItemId());
        source.setMatchStatus(PekMatchStatus.MANUALLY_MATCHED);
        source.setMatchType("MANUAL");
        source.setManual(true);
        source.setExcluded(false);
        source.setMatchedBy(CurrentUser.get().getId());
        source.setMatchedAt(LocalDateTime.now());
        source.setUpdatedAt(LocalDateTime.now());
        source.setMatchReason("Ручное сопоставление");
        sourceRepository.saveAndFlush(source);
        planFactService.recompute(report);
        contentRevisionService.bump(report);
        recordHistory(report, report.getStatus(), "MATCH_SOURCE", "sourceId=" + sourceId,
                CurrentUser.get().getId(), report.getVersion());
        return sourceDto(source);
    }

    @Transactional
    public PekApiDtos.ReportSourceItem excludeSource(Long reportId, Long sourceId, PekApiDtos.SourceMutationRequest request, Long version) {
        PekReport report = getOrThrow(reportId);
        User excludeActor = CurrentUser.get();
        accessService.requireCompanyEditPermission(excludeActor.getId(), excludeActor.getRole(), report.getCompanyId());
        workflowGuard.requireEditable(report);
        PekReportProtocolSource source = sourceForReport(reportId, sourceId);
        checkSourceVersion(source, version);
        source.setExcluded(true);
        source.setMatchStatus(PekMatchStatus.EXCLUDED);
        source.setExclusionReason(request.reason());
        source.setUpdatedAt(LocalDateTime.now());
        sourceRepository.saveAndFlush(source);
        planFactService.recompute(report);
        contentRevisionService.bump(report);
        recordHistory(report, report.getStatus(), "EXCLUDE_SOURCE", request.reason(),
                CurrentUser.get().getId(), report.getVersion());
        return sourceDto(source);
    }

    @Transactional
    public PekApiDtos.ReportSourceItem restoreSource(Long reportId, Long sourceId, PekApiDtos.SourceMutationRequest request, Long version) {
        PekReport report = getOrThrow(reportId);
        User restoreActor = CurrentUser.get();
        accessService.requireCompanyEditPermission(restoreActor.getId(), restoreActor.getRole(), report.getCompanyId());
        workflowGuard.requireEditable(report);
        PekReportProtocolSource source = sourceForReport(reportId, sourceId);
        checkSourceVersion(source, version);
        eligibilityService.requireEligible(report, protocolRepository.findById(source.getProtocolId())
                .orElseThrow(() -> new NotFoundException("Протокол не найден")), false);
        source.setExcluded(false);
        source.setExclusionReason(null);
        source.setMatchStatus(source.getProgramIndicatorId() == null ? PekMatchStatus.UNMATCHED
                : source.isManual() ? PekMatchStatus.MANUALLY_MATCHED : PekMatchStatus.MATCHED);
        source.setUpdatedAt(LocalDateTime.now());
        sourceRepository.saveAndFlush(source);
        planFactService.recompute(report);
        contentRevisionService.bump(report);
        recordHistory(report, report.getStatus(), "RESTORE_SOURCE", request.reason(),
                CurrentUser.get().getId(), report.getVersion());
        return sourceDto(source);
    }

    @Transactional
    public PekApiDtos.ReportResponse submitForReview(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        User actor = CurrentUser.get();
        accessService.requireCompanyEditPermission(actor.getId(), actor.getRole(), report.getCompanyId());
        requireTransition(report, PekReportStatus.READY_FOR_REVIEW);
        PekApiDtos.ReadinessResponse readiness = readinessService.evaluate(report);
        if (!readiness.ready()) {
            throw new ConflictException("Отчёт ПЭК не готов: " + readiness.issues().get(0).message(), "PEK_REPORT_NOT_READY");
        }
        if (report.getLinkedProtocolCount() == 0) {
            throw new ConflictException("Нет ни одного связанного протокола - выполните сбор данных",
                    "PEK_REPORT_NO_PROTOCOLS");
        }
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.READY_FOR_REVIEW);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.saveAndFlush(report);
        recordHistory(report, before, "SUBMIT_REVIEW", null, CurrentUser.get().getId(), versionBefore);
        return toResponse(report);
    }

    @Transactional
    public PekApiDtos.ReportResponse approve(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        requireTransition(report, PekReportStatus.APPROVED);
        User approveActor = CurrentUser.get();
        accessService.requireCompanyReviewPermission(approveActor.getId(), approveActor.getRole(), report.getCompanyId());
        requireNotSelfApproval(report.getCreatedBy());
        PekApiDtos.ReadinessResponse readiness = readinessService.evaluate(report);
        if (!readiness.ready()) {
            throw new ConflictException("Отчёт не готов к утверждению", "PEK_REPORT_NOT_READY");
        }
        // If a document was already generated for this report, it must still reflect the report's
        // current content - approving a report whose only generated artifact is stale would let a
        // signer later sign a document nobody actually approved.
        documentVersionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(
                        report.getId(), PekReportDocumentType.OFFICIAL)
                .ifPresent(v -> contentRevisionService.requireCurrent(v.getSourceContentRevision(), report));
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.APPROVED);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.saveAndFlush(report);
        recordHistory(report, before, "APPROVE", null, CurrentUser.get().getId(), versionBefore);
        return toResponse(report);
    }

    @Transactional
    public PekApiDtos.ReportResponse returnForRevision(Long id, Long version, String reason) {
        if (reason == null || reason.isBlank())
            throw new BadRequestException("Укажите причину возврата", "PEK_RETURN_REASON_REQUIRED");
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        User returnActor = CurrentUser.get();
        accessService.requireCompanyReviewPermission(returnActor.getId(), returnActor.getRole(), report.getCompanyId());
        requireTransition(report, PekReportStatus.RETURNED);
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.RETURNED);
        report.setReturnReason(reason.trim());
        report.setReturnedAt(LocalDateTime.now());
        report.setReturnedByUserId(CurrentUser.get().getId());
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.saveAndFlush(report);
        recordHistory(report, before, "RETURN", reason.trim(), CurrentUser.get().getId(), versionBefore);
        return toResponse(report);
    }

    @Transactional
    public PekApiDtos.ReportResponse archive(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        User archiveActor = CurrentUser.get();
        accessService.requireCompanyReviewPermission(archiveActor.getId(), archiveActor.getRole(), report.getCompanyId());
        requireTransition(report, PekReportStatus.ARCHIVED);
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.ARCHIVED);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.saveAndFlush(report);
        recordHistory(report, before, "ARCHIVE", null, CurrentUser.get().getId(), versionBefore);
        return toResponse(report);
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ReportResponse get(Long id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ReportHistoryEntry> history(Long id) {
        getOrThrow(id);
        return historyRepository.findByReportIdOrderByPerformedAtAscIdAsc(id).stream().map(h -> {
            PekApiDtos.UserShortDto actor = userRepository.findById(h.getPerformedBy())
                    .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                    .orElse(null);
            return new PekApiDtos.ReportHistoryEntry(h.getAction(),
                    h.getFromStatus() == null ? null : h.getFromStatus().name(),
                    h.getToStatus() == null ? null : h.getToStatus().name(), h.getComment(), actor,
                    h.getPerformedAt().toString(), h.getVersionAfter());
        }).toList();
    }

    /** Real numbers, not fabricated: reads whatever PekPlanFactService last persisted (via
     *  collect()) - it does not recompute here, since recomputation belongs to the one operation
     *  that establishes new evidence (collect), not to every read. */
    @Transactional(readOnly = true)
    public PekApiDtos.PlanFactResponse getPlanFact(Long id) {
        PekReport report = getOrThrow(id);
        List<PekReportPlanFactRow> rows = planFactRowRepository.findByReportIdOrderByControlItemIdAsc(report.getId());

        java.util.Map<Long, PekProgramControlItem> controlItemsById = new java.util.HashMap<>();
        controlItemRepository.findAllById(rows.stream().map(PekReportPlanFactRow::getControlItemId).distinct().toList())
                .forEach(item -> controlItemsById.put(item.getId(), item));
        java.util.Map<Long, PekProgramIndicator> indicatorsById = new java.util.HashMap<>();
        indicatorRepository.findAllById(rows.stream().map(PekReportPlanFactRow::getProgramIndicatorId).distinct().toList())
                .forEach(indicator -> indicatorsById.put(indicator.getId(), indicator));

        List<PekApiDtos.PlanFactItem> items = rows.stream().map(row -> {
            PekProgramControlItem controlItem = controlItemsById.get(row.getControlItemId());
            PekProgramIndicator indicator = indicatorsById.get(row.getProgramIndicatorId());
            return new PekApiDtos.PlanFactItem(
                    row.getId(),
                    row.getControlItemId(),
                    controlItem != null ? controlItem.getName() : null,
                    row.getProgramIndicatorId(),
                    indicator != null ? indicator.getIndicatorName() : null,
                    indicator != null ? indicator.getUnit() : null,
                    row.getPlannedCount(),
                    row.getActualCount(),
                    row.getMissingCount(),
                    row.getCompletionPercent(),
                    row.getNormativeValue(),
                    row.getComparisonType() != null ? row.getComparisonType().name() : null,
                    row.getBestValue(),
                    row.getWorstValue(),
                    row.getAverageValue(),
                    row.isHasExceedance(),
                    row.getExceedanceCount(),
                    row.effectiveStatus().name());
        }).toList();

        int planned = rows.stream().mapToInt(PekReportPlanFactRow::getPlannedCount).sum();
        int actual = rows.stream().mapToInt(PekReportPlanFactRow::getActualCount).sum();
        int missing = rows.stream().mapToInt(PekReportPlanFactRow::getMissingCount).sum();
        int exceedances = rows.stream().mapToInt(PekReportPlanFactRow::getExceedanceCount).sum();
        java.math.BigDecimal completionPercent = planned > 0
                ? java.math.BigDecimal.valueOf(Math.min(actual, planned) * 100L)
                        .divide(java.math.BigDecimal.valueOf(planned), 2, java.math.RoundingMode.HALF_UP)
                : (actual > 0 ? java.math.BigDecimal.valueOf(100) : java.math.BigDecimal.ZERO);

        return new PekApiDtos.PlanFactResponse(
                new PekApiDtos.PlanFactSummary(planned, actual, missing, completionPercent, exceedances),
                items);
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ReportResponse> listForObject(Long companyId, Long objectId) {
        return reportRepository.findByCompanyIdAndObjectIdOrderByPeriodStartDesc(companyId, objectId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<PekApiDtos.ReportResponse> listForObjectPaged(Long companyId, Long objectId,
                                                                       Integer page, Integer size) {
        Pageable pageable = PageRequest.of(resolvePage(page), resolveSize(size), Sort.by(Sort.Direction.DESC, "periodStart"));
        return PageResponse.of(reportRepository.findByCompanyIdAndObjectId(companyId, objectId, pageable), this::toResponse);
    }

    /** Module fix item 4: filtering (objectId/programId/status/issue) happens in
     *  {@link PekReportRepository#search} - at the SQL level, before pagination - so
     *  totalElements/totalPages in the returned page always reflect the filtered result set. */
    @Transactional(readOnly = true)
    public PageResponse<PekApiDtos.ReportResponse> search(Long companyId, Long objectId, Long programId,
                                                            String status, String issue,
                                                            Integer page, Integer size, String sort) {
        PekReportStatus statusEnum = null;
        if (status != null && !status.isBlank()) {
            try {
                statusEnum = PekReportStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new BadRequestException("Неизвестный статус отчёта ПЭК: " + status, "PEK_INVALID_STATUS");
            }
        }
        Pageable pageable = PageRequest.of(resolvePage(page), resolveSize(size), resolveSort(sort));
        return PageResponse.of(
                reportRepository.search(companyId, objectId, programId, statusEnum, issue, pageable),
                this::toResponse);
    }

    private static Sort resolveSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "periodStart");
        }
        String[] parts = sort.split(",", 2);
        String property = SORTABLE_FIELDS.contains(parts[0]) ? parts[0] : "periodStart";
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }

    private static final java.util.Set<String> SORTABLE_FIELDS = java.util.Set.of(
            "periodStart", "periodEnd", "reportYear", "status", "createdAt", "updatedAt");

    private static int resolvePage(Integer page) {
        return page != null && page >= 0 ? page : 0;
    }

    private static int resolveSize(Integer size) {
        if (size == null || size <= 0) {
            return 20;
        }
        return Math.min(size, 100);
    }

    /** Version is now mandatory (module spec §2.2) - see PekProgramService#checkVersion for why
     *  a null requestVersion must fail loud rather than silently skip the check. */
    private static void checkVersion(PekReport report, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Требуется заголовок If-Match с текущей версией отчёта ПЭК", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(report.getVersion())) {
            throw new ConflictException("Отчёт ПЭК был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }
    }

    private void requireTransition(PekReport report, PekReportStatus target) {
        if (!report.getStatus().canTransitionTo(target)) {
            throw new ConflictException("Переход из " + report.getStatus() + " в " + target + " недопустим",
                    "INVALID_REPORT_STATUS_TRANSITION");
        }
    }

    /** Maker-checker (module fix): the person who created (authored) this report must not be the
     *  same person who approves it - independent review is the whole point of the APPROVE step.
     *  Deliberately NOT applied to submit/return/archive/collect - those don't represent an
     *  independent-approval business requirement, only APPROVE does. Checked in the service, not
     *  just left to the UI, so a direct API call can't bypass it. */
    private void requireNotSelfApproval(Long createdBy) {
        Long actorId = CurrentUser.get().getId();
        if (createdBy != null && createdBy.equals(actorId)) {
            throw new ConflictException(
                    "Автор отчёта не может самостоятельно утвердить его - требуется независимое согласование",
                    "PEK_MAKER_CHECKER_VIOLATION");
        }
    }

    private CompanyObject validateObject(Long companyId, Long objectId, List<String> blockers) {
        if (companyId == null) {
            blockers.add("Укажите companyId");
            return null;
        }
        if (objectId == null) {
            blockers.add("Укажите objectId");
            return null;
        }
        Company company = companyRepository.findById(companyId).orElse(null);
        if (company == null) {
            blockers.add("Компания не найдена");
            return null;
        }
        // objectId must be a real CompanyObject belonging to companyId - PEK never treats
        // companyId as a stand-in objectId (spec: no virtual objects derived from companyId).
        CompanyObject object = companyObjectRepository.findByIdAndCompanyId(objectId, company.getId()).orElse(null);
        if (object == null) {
            blockers.add("Объект не найден или не принадлежит выбранной компании");
            return null;
        }
        if (object.getArchivedAt() != null) {
            blockers.add("Объект архивирован");
            return null;
        }
        return object;
    }

    private static PekPeriodType parsePeriodType(String raw, List<String> blockers) {
        if (raw == null || raw.isBlank()) {
            blockers.add("Укажите periodType");
            return null;
        }
        try {
            return PekPeriodType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            blockers.add("Неизвестный periodType: " + raw);
            return null;
        }
    }

    private static PekPeriodType parsePeriodTypeOrThrow(String raw) {
        List<String> blockers = new ArrayList<>();
        PekPeriodType type = parsePeriodType(raw, blockers);
        if (type == null) {
            throw new BadRequestException(blockers.get(0));
        }
        return type;
    }

    public PekReport getReportById(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    PekReport getOrThrow(Long id) {
        return getReportById(id);
    }

    PekApiDtos.ReportResponse toResponse(PekReport r) {
        PekApiDtos.CompanyShortDto company = companyRepository.findById(r.getCompanyId())
                .map(c -> new PekApiDtos.CompanyShortDto(c.getId(), c.getName(), c.getBin()))
                .orElse(null);
        PekApiDtos.CompanyObjectShortDto object = companyObjectRepository.findById(r.getObjectId())
                .map(o -> new PekApiDtos.CompanyObjectShortDto(o.getId(), o.getName()))
                .orElse(null);
        PekApiDtos.UserShortDto responsibleUser = r.getResponsibleUserId() == null ? null
                : userRepository.findById(r.getResponsibleUserId())
                        .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                        .orElse(null);
        PekApiDtos.UserShortDto returnedBy = r.getReturnedByUserId() == null ? null
                : userRepository.findById(r.getReturnedByUserId())
                        .map(u -> new PekApiDtos.UserShortDto(u.getId(), u.getName(), u.getEmail(), u.getPosition()))
                        .orElse(null);
        PekApiDtos.ReturnInfo returnInfo = r.getReturnReason() == null ? null
                : new PekApiDtos.ReturnInfo(r.getReturnReason(),
                        r.getReturnedAt() == null ? null : r.getReturnedAt().toString(), returnedBy);
        return new PekApiDtos.ReportResponse(
                r.getId(), r.getCompanyId(), r.getObjectId(), r.getProgramId(),
                r.getPeriodType().name(), r.getReportYear(), r.getReportQuarter(),
                r.getPeriodStart().toString(), r.getPeriodEnd().toString(), r.getStatus().name(),
                r.getLinkedProtocolCount(), r.getLastCollectedAt() != null ? r.getLastCollectedAt().toString() : null,
                r.getVersion(), company, object, responsibleUser, availableActions(r), returnInfo,
                iso(r.getSubmissionDueDate()), iso(r.getSubmittedAt()), iso(r.getAcceptedAt()),
                iso(r.getRejectedAt()), r.getRejectionReason());
    }

    /** ISO-8601, or null while the corresponding submission transition has not happened. */
    private static String iso(java.time.temporal.Temporal value) {
        return value == null ? null : value.toString();
    }

    /**
     * Mirrors {@link PekSecurityExpressions}' PEK_REPORT_* role unions exactly (single source of
     * truth stays the @PreAuthorize on each PekController endpoint; this just pre-computes, per
     * report, whether THIS caller would pass that check for THIS report's current status) - company
     * scope is already enforced by the caller (PekController#requireReportAccess runs before
     * toResponse is ever reached), so it does not need to be re-checked here. submitReview/approve
     * are additionally gated on readiness (module spec: a client must not see "submit" enabled only
     * to have the server 409 PEK_REPORT_NOT_READY a moment later) - cheap to recompute since
     * PekReportReadinessService only reads what's already been loaded for this single report.
     */
    private java.util.Map<String, Boolean> availableActions(PekReport report) {
        var user = CurrentUser.getOrNull();
        var role = user == null ? null : user.getRole();
        boolean author = role == kz.eco.user.UserRole.ECOLOGIST || role == kz.eco.user.UserRole.ADMIN
                || role == kz.eco.user.UserRole.DIRECTOR || role == kz.eco.user.UserRole.HEAD;
        boolean laboratory = role == kz.eco.user.UserRole.LABORATORY;
        boolean reviewer = role == kz.eco.user.UserRole.ADMIN || role == kz.eco.user.UserRole.DIRECTOR || role == kz.eco.user.UserRole.HEAD;
        boolean isCreator = user != null && user.getId().equals(report.getCreatedBy());
        boolean submitReviewEligible = author
                && (report.getStatus() == PekReportStatus.COLLECTING || report.getStatus() == PekReportStatus.RETURNED);
        // Maker-checker (module fix item 8): the report's own creator must never see approve
        // enabled for their own submission - mirrors the actual PEK_MAKER_CHECKER_VIOLATION check
        // in approve() below.
        boolean approveEligible = reviewer && !isCreator && report.getStatus() == PekReportStatus.READY_FOR_REVIEW;
        boolean ready = (submitReviewEligible || approveEligible) && readinessService.evaluate(report).ready();

        // generateDocument mirrors PekReportDocumentGenerationService#requireRegenerationAllowed
        // (blocked once SIGNED/ARCHIVED) and PEK_REPORT_EDIT's role set (author || laboratory).
        boolean generateDocument = (author || laboratory)
                && report.getStatus() != PekReportStatus.SIGNED && report.getStatus() != PekReportStatus.ARCHIVED;
        // Latest generated document version (if any) - drives downloadDocx/downloadPdf/sign, all
        // of which must reflect what actually exists in storage, not just workflow status.
        // availableActions must describe the OFFICIAL document only - downloadDocx/downloadPdf/sign
        // all act on the official report, so an INTERNAL version must never flip these flags.
        var latestVersion = documentVersionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(
                report.getId(), PekReportDocumentType.OFFICIAL);
        boolean hasDocx = latestVersion.map(v -> v.getDocxFileId() != null).orElse(false);
        boolean hasPdf = latestVersion.map(v -> v.getPdfFileId() != null).orElse(false);
        // Module fix item 3: the same staleness check requireCurrent enforces server-side at
        // download/sign time (sourceContentRevision != report.contentRevision) - downloadDocx/
        // downloadPdf/sign must never say true for a document the corresponding endpoint would
        // then reject as PEK_DOCUMENT_STALE.
        boolean stale = latestVersion.map(v -> v.getSourceContentRevision() != null
                        && !v.getSourceContentRevision().equals(report.getContentRevision()))
                .orElse(false);
        // sign mirrors PekReportSigningService#sign's real precondition exactly (status ==
        // APPROVED, valid transition to SIGNED, readiness, a PDF to actually sign) plus
        // PEK_REPORT_SIGN's role set, which is identical to "author" here (ADMIN,DIRECTOR,HEAD,
        // ECOLOGIST). Must never report true when the PDF is missing - PekReportSigningService
        // re-checks this same condition server-side regardless of what this response says.
        boolean sign = author && report.getStatus() == PekReportStatus.APPROVED
                && report.getStatus().canTransitionTo(PekReportStatus.SIGNED)
                && hasPdf && !stale
                && readinessService.evaluate(report).ready();
        // manageExceedance/reviewExceedance reuse PekExceedanceService's REVIEWER_ROLES convention
        // (ADMIN, DIRECTOR, HEAD) - manage covers assign/attach-evidence-level actions available
        // whenever the caller may act on this report's exceedances at all; review is narrowed to
        // reports that actually have at least one exceedance row to review.
        boolean manageExceedance = reviewer;
        boolean reviewExceedance = reviewer && !exceedanceRepository.findByReportId(report.getId()).isEmpty();

        // Post-signing regulatory submission (module fix): distinct from the internal
        // submitReview/approve review cycle above - SIGNED -> SUBMITTED -> ACCEPTED/REJECTED.
        // Gated on PEK_REPORT_EDIT's exact role set (author || laboratory), mirroring
        // PekController#submitReport/acceptReport/rejectReport's @PreAuthorize precisely, so these
        // flags never say true for a call the endpoint would then 403.
        boolean canSubmitAccept = author || laboratory;
        boolean submit = canSubmitAccept && report.getStatus().canTransitionTo(PekReportStatus.SUBMITTED)
                && documentVersionRepository.existsByReportIdAndDocumentType(report.getId(), PekReportDocumentType.OFFICIAL);
        boolean accept = canSubmitAccept && report.getStatus().canTransitionTo(PekReportStatus.ACCEPTED);
        boolean reject = canSubmitAccept && report.getStatus().canTransitionTo(PekReportStatus.REJECTED);

        // Internal analytical document mirrors the official one's hasDocx/hasPdf/stale computation
        // but against its OWN latest version - an official document being stale/missing must never
        // affect the internal report's own flags, and vice versa.
        var latestInternalVersion = documentVersionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(
                report.getId(), PekReportDocumentType.INTERNAL);
        boolean hasInternalDocx = latestInternalVersion.map(v -> v.getDocxFileId() != null).orElse(false);
        boolean hasInternalPdf = latestInternalVersion.map(v -> v.getPdfFileId() != null).orElse(false);
        boolean internalStale = latestInternalVersion.map(v -> v.getSourceContentRevision() != null
                        && !v.getSourceContentRevision().equals(report.getContentRevision()))
                .orElse(false);
        boolean generateInternalAnalyticalReport = (author || laboratory) && report.getStatus() != PekReportStatus.ARCHIVED;
        boolean downloadInternalAnalyticalReport = (hasInternalDocx || hasInternalPdf) && !internalStale;

        java.util.Map<String, Boolean> actions = new java.util.LinkedHashMap<>();
        actions.put("edit", (author || laboratory) && report.getStatus().isEditable());
        actions.put("collect", (author || laboratory) && report.getStatus().isEditable());
        actions.put("matchSources", (author || laboratory) && report.getStatus().isEditable());
        actions.put("submitReview", submitReviewEligible && ready);
        actions.put("returnForRevision", reviewer && report.getStatus() == PekReportStatus.READY_FOR_REVIEW);
        actions.put("approve", approveEligible && ready);
        // Module fix item 2: SIGNED -> ARCHIVED is a valid workflow transition (PekReportStatus
        // already allows it) but this previously only reflected APPROVED -> ARCHIVED, so a signed
        // report's availableActions.archive silently stayed false even though the endpoint would
        // have accepted it.
        actions.put("archive", reviewer
                && (report.getStatus() == PekReportStatus.APPROVED || report.getStatus() == PekReportStatus.SIGNED));
        actions.put("generateDocument", generateDocument);
        actions.put("downloadDocx", hasDocx && !stale);
        actions.put("downloadPdf", hasPdf && !stale);
        actions.put("sign", sign);
        actions.put("manageExceedance", manageExceedance);
        actions.put("reviewExceedance", reviewExceedance);
        actions.put("submit", submit);
        actions.put("accept", accept);
        actions.put("reject", reject);
        actions.put("generateOfficialDocument", generateDocument);
        actions.put("previewOfficialDocument", hasPdf && !stale);
        actions.put("downloadOfficialDocument", (hasDocx || hasPdf) && !stale);
        actions.put("signOfficialDocument", sign);
        actions.put("generateInternalAnalyticalReport", generateInternalAnalyticalReport);
        actions.put("previewInternalAnalyticalReport", hasInternalPdf && !internalStale);
        actions.put("downloadInternalAnalyticalReport", downloadInternalAnalyticalReport);
        return actions;
    }

    private PekReportProtocolSource sourceForReport(Long reportId, Long sourceId) {
        PekReportProtocolSource source = sourceRepository.findById(sourceId)
                .orElseThrow(() -> new NotFoundException("Источник отчёта ПЭК не найден: " + sourceId));
        if (!source.getReportId().equals(reportId)) throw new NotFoundException("Источник отчёта ПЭК не найден: " + sourceId);
        return source;
    }

    private PekApiDtos.ReportSourceItem sourceDto(PekReportProtocolSource s) {
        PekProgramIndicator indicator = s.getProgramIndicatorId() == null ? null : indicatorRepository.findById(s.getProgramIndicatorId()).orElse(null);
        String number = protocolRepository.findById(s.getProtocolId()).map(p -> p.getProtocolNumber()).orElse(null);
        return new PekApiDtos.ReportSourceItem(s.getId(), s.getProtocolId(), number, s.getProtocolResultId(),
                indicator == null ? null : indicator.getIndicatorName(), indicator == null ? null : indicator.getUnit(),
                s.getControlItemId(), s.getProgramIndicatorId(), s.getMatchStatus().name(), s.getMatchType(), s.isManual(),
                s.isExcluded(), s.getExclusionReason(), s.getSourceVersion(), s.getVersion(), s.getMatchReason(),
                s.getMatchedAt() == null ? null : s.getMatchedAt().toString(), s.getUpdatedAt() == null ? null : s.getUpdatedAt().toString());
    }

    private static void checkSourceVersion(PekReportProtocolSource source, Long version) {
        if (version == null) throw new BadRequestException("Требуется version", "VERSION_REQUIRED");
        if (!version.equals(source.getVersion())) throw ConflictException.versionConflict("Данные были изменены другим сотрудником", "PEK_VERSION_CONFLICT", source.getVersion());
    }

    private void recordHistory(PekReport report, PekReportStatus from, String action, String comment,
                               Long actorId, Long versionBefore) {
        PekReportWorkflowHistory h = new PekReportWorkflowHistory();
        h.setReportId(report.getId()); h.setFromStatus(from); h.setToStatus(report.getStatus());
        h.setAction(action); h.setComment(comment); h.setPerformedBy(actorId);
        h.setVersionBefore(versionBefore); h.setVersionAfter(report.getVersion());
        historyRepository.save(h);
    }
}
