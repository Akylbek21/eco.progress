package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.common.PageResponse;
import kz.eco.pek.dto.PekApiDtos;
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
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final UserRepository userRepository;

    public PekReportService(PekReportRepository reportRepository, PekProgramRepository programRepository,
                            PekProgramService programService, PekReportCollectionService collectionService,
                            CompanyRepository companyRepository, CompanyObjectRepository companyObjectRepository,
                            UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.programRepository = programRepository;
        this.programService = programService;
        this.collectionService = collectionService;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.userRepository = userRepository;
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
        PekPeriodType periodType = parsePeriodTypeOrThrow(request.periodType());
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
        if (!program.getObjectId().equals(object.getId()) || !program.getCompanyId().equals(request.companyId())) {
            throw new BadRequestException("Программа ПЭК относится к другому объекту");
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
        report.setCreatedBy(userId);
        report.computePeriodKey();
        try {
            reportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Отчёт за этот период уже создан", "PEK_REPORT_DUPLICATE");
        }

        if (Boolean.TRUE.equals(request.collectImmediately())) {
            // Real synchronous collection, run in the same transaction as creation - not a stub,
            // not a fire-and-forget async task with no status to poll. If collection itself fails,
            // the whole create() call fails too rather than silently leaving a half-collected report.
            collectionService.collect(report);
            reportRepository.save(report);
        }
        return toResponse(report);
    }

    private static String periodKeyOf(PekPeriodType periodType, Integer year, Integer quarter) {
        return periodType == PekPeriodType.YEAR ? year + "-YEAR" : year + "-Q" + quarter;
    }

    @Transactional
    public PekApiDtos.CollectionResult collect(Long id) {
        PekReport report = getOrThrow(id);
        PekApiDtos.CollectionResult result = collectionService.collect(report);
        reportRepository.save(report);
        return new PekApiDtos.CollectionResult(toResponse(report), result.linkedProtocolCount(), result.linkedProtocolNumbers());
    }

    @Transactional
    public PekApiDtos.ReportResponse submitForReview(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        requireTransition(report, PekReportStatus.READY_FOR_REVIEW);
        if (report.getLinkedProtocolCount() == 0) {
            throw new ConflictException("Нет ни одного связанного протокола - выполните сбор данных",
                    "PEK_REPORT_NO_PROTOCOLS");
        }
        report.setStatus(PekReportStatus.READY_FOR_REVIEW);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.save(report);
        return toResponse(report);
    }

    @Transactional
    public PekApiDtos.ReportResponse approve(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        requireTransition(report, PekReportStatus.APPROVED);
        report.setStatus(PekReportStatus.APPROVED);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.save(report);
        return toResponse(report);
    }

    @Transactional
    public PekApiDtos.ReportResponse archive(Long id, Long version) {
        PekReport report = getOrThrow(id);
        checkVersion(report, version);
        requireTransition(report, PekReportStatus.ARCHIVED);
        report.setStatus(PekReportStatus.ARCHIVED);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.save(report);
        return toResponse(report);
    }

    @Transactional(readOnly = true)
    public PekApiDtos.ReportResponse get(Long id) {
        return toResponse(getOrThrow(id));
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
                    "PEK_REPORT_INVALID_TRANSITION");
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

    PekReport getOrThrow(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
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
        return new PekApiDtos.ReportResponse(
                r.getId(), r.getCompanyId(), r.getObjectId(), r.getProgramId(),
                r.getPeriodType().name(), r.getReportYear(), r.getReportQuarter(),
                r.getPeriodStart().toString(), r.getPeriodEnd().toString(), r.getStatus().name(),
                r.getLinkedProtocolCount(), r.getLastCollectedAt() != null ? r.getLastCollectedAt().toString() : null,
                r.getVersion(), company, object, responsibleUser);
    }
}
