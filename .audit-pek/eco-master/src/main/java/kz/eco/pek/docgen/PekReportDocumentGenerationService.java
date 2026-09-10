package kz.eco.pek.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.PekDischargeSourceRepository;
import kz.eco.pek.PekEmissionSourceRepository;
import kz.eco.pek.PekEnvironmentalPermit;
import kz.eco.pek.PekEnvironmentalPermitRepository;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekMonitoringType;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportDocumentVersion;
import kz.eco.pek.PekReportDocumentVersionRepository;
import kz.eco.pek.PekReportExceedance;
import kz.eco.pek.PekReportExceedanceRepository;
import kz.eco.pek.PekReportPlanFactRow;
import kz.eco.pek.PekReportPlanFactRowRepository;
import kz.eco.pek.PekReportProtocolSource;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.pek.PekReportRepository;
import kz.eco.pek.PekReportWasteMovement;
import kz.eco.pek.PekReportWasteMovementRepository;
import kz.eco.pek.PekWasteItemRepository;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * PEK final-report DOCX/PDF generation (Iteration 3 of the PEK module overhaul). Mirrors
 * kz.eco.protocol.ProtocolDocumentGenerationService's structure: assemble a data snapshot, render
 * it via a POI-based renderer (PekReportDocxRenderer, in this package), optionally convert to PDF
 * via the same LibreOffice-with-fallback approach, and persist the result through
 * FileStorageService. The key difference from the protocol flow is version history - every call
 * here inserts a new immutable PekReportDocumentVersion row (never overwrites/deletes an old one),
 * since a signed report must forever be traceable to the exact document version that was signed.
 */
@Service
public class PekReportDocumentGenerationService {

    private static final Logger log = LoggerFactory.getLogger(PekReportDocumentGenerationService.class);
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final PekReportRepository reportRepository;
    private final PekReportDocumentVersionRepository versionRepository;
    private final PekProgramRepository programRepository;
    private final PekReportPlanFactRowRepository planFactRowRepository;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekEnvironmentalPermitRepository permitRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final ProtocolRepository protocolRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekMonitoringPointRepository monitoringPointRepository;
    private final PekEmissionSourceRepository emissionSourceRepository;
    private final PekDischargeSourceRepository dischargeSourceRepository;
    private final PekWasteItemRepository wasteItemRepository;
    private final PekReportWasteMovementRepository wasteMovementRepository;
    private final ObjectMapper objectMapper;

    public PekReportDocumentGenerationService(PekReportRepository reportRepository,
                                               PekReportDocumentVersionRepository versionRepository,
                                               PekProgramRepository programRepository,
                                               PekReportPlanFactRowRepository planFactRowRepository,
                                               PekProgramControlItemRepository controlItemRepository,
                                               PekReportExceedanceRepository exceedanceRepository,
                                               PekEnvironmentalPermitRepository permitRepository,
                                               PekReportProtocolSourceRepository sourceRepository,
                                               ProtocolRepository protocolRepository,
                                               CompanyRepository companyRepository,
                                               CompanyObjectRepository companyObjectRepository,
                                               UserRepository userRepository,
                                               FileStorageService fileStorageService,
                                               ObjectMapper objectMapper,
                                               PekProgramMonitoringRepository monitoringRepository,
                                               PekMonitoringPointRepository monitoringPointRepository,
                                               PekEmissionSourceRepository emissionSourceRepository,
                                               PekDischargeSourceRepository dischargeSourceRepository,
                                               PekWasteItemRepository wasteItemRepository,
                                               PekReportWasteMovementRepository wasteMovementRepository) {
        this.reportRepository = reportRepository;
        this.versionRepository = versionRepository;
        this.programRepository = programRepository;
        this.planFactRowRepository = planFactRowRepository;
        this.controlItemRepository = controlItemRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.permitRepository = permitRepository;
        this.sourceRepository = sourceRepository;
        this.protocolRepository = protocolRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.objectMapper = objectMapper;
        this.monitoringRepository = monitoringRepository;
        this.monitoringPointRepository = monitoringPointRepository;
        this.emissionSourceRepository = emissionSourceRepository;
        this.dischargeSourceRepository = dischargeSourceRepository;
        this.wasteItemRepository = wasteItemRepository;
        this.wasteMovementRepository = wasteMovementRepository;
    }

    /** Generates official DOCX (state-facing, versioned normative template). */
    @Transactional
    public PekReportDocumentVersion generateOfficialDocx(Long reportId, Long userId) {
        PekReport report = getReport(reportId);
        requireRegenerationAllowed(report);
        OfficialPekReportDocValues values = buildOfficialValues(report);
        byte[] docx;
        try {
            docx = OfficialPekReportDocxRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать официальный DOCX ПЭК: " + e.getMessage());
        }
        PekReportDocumentVersion version = newVersionTyped(report, values, userId,
                kz.eco.pek.PekReportDocumentType.OFFICIAL, objectMapper.writeValueAsString(values));
        try {
            StoredFileMetadata meta = fileStorageService.storeBytes(docx,
                    "pek-official-" + report.getId() + "-v" + version.getVersion() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "pek-report-" + report.getId(), String.valueOf(userId));
            version.setDocxFileId(meta.fileId());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить официальный DOCX ПЭК: " + e.getMessage());
        }
        version.setContentHash(sha256Hex(docx));
        return versionRepository.saveAndFlush(version);
    }

    /** Generates official DOCX + PDF (the normal pre-signing path). */
    @Transactional
    public PekReportDocumentVersion generateOfficialPdf(Long reportId, Long userId) {
        PekReport report = getReport(reportId);
        requireRegenerationAllowed(report);
        OfficialPekReportDocValues values = buildOfficialValues(report);
        byte[] docx;
        try {
            docx = OfficialPekReportDocxRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать официальный DOCX ПЭК: " + e.getMessage());
        }
        byte[] pdf = PekReportPdfConverter.convert(docx);
        PekReportDocumentVersion version = newVersionTyped(report, values, userId,
                kz.eco.pek.PekReportDocumentType.OFFICIAL, objectMapper.writeValueAsString(values));
        try {
            StoredFileMetadata docxMeta = fileStorageService.storeBytes(docx,
                    "pek-official-" + report.getId() + "-v" + version.getVersion() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "pek-report-" + report.getId(), String.valueOf(userId));
            version.setDocxFileId(docxMeta.fileId());
            StoredFileMetadata pdfMeta = fileStorageService.storeBytes(pdf,
                    "pek-official-" + report.getId() + "-v" + version.getVersion() + ".pdf",
                    "application/pdf", "pek-report-" + report.getId(), String.valueOf(userId));
            version.setPdfFileId(pdfMeta.fileId());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить официальные документы ПЭК: " + e.getMessage());
        }
        version.setContentHash(sha256Hex(pdf));
        return versionRepository.saveAndFlush(version);
    }

    /** Generates internal CRM analytical DOCX. */
    @Transactional
    public PekReportDocumentVersion generateInternalDocx(Long reportId, Long userId) {
        PekReport report = getReport(reportId);
        requireRegenerationAllowed(report);
        InternalPekAnalyticalDocValues values = buildInternalValues(report);
        byte[] docx;
        try {
            docx = InternalPekAnalyticalReportRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать внутренний аналитический DOCX ПЭК: " + e.getMessage());
        }
        PekReportDocumentVersion version = newVersionTyped(report, values, userId,
                kz.eco.pek.PekReportDocumentType.INTERNAL, objectMapper.writeValueAsString(values));
        try {
            StoredFileMetadata meta = fileStorageService.storeBytes(docx,
                    "pek-internal-" + report.getId() + "-v" + version.getVersion() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "pek-report-" + report.getId(), String.valueOf(userId));
            version.setDocxFileId(meta.fileId());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить внутренний аналитический DOCX ПЭК: " + e.getMessage());
        }
        version.setContentHash(sha256Hex(docx));
        return versionRepository.saveAndFlush(version);
    }

    /** Generates internal CRM analytical DOCX + PDF. */
    @Transactional
    public PekReportDocumentVersion generateInternalPdf(Long reportId, Long userId) {
        PekReport report = getReport(reportId);
        requireRegenerationAllowed(report);
        InternalPekAnalyticalDocValues values = buildInternalValues(report);
        byte[] docx;
        try {
            docx = InternalPekAnalyticalReportRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать внутренний аналитический DOCX ПЭК: " + e.getMessage());
        }
        byte[] pdf = PekReportPdfConverter.convert(docx);
        PekReportDocumentVersion version = newVersionTyped(report, values, userId,
                kz.eco.pek.PekReportDocumentType.INTERNAL, objectMapper.writeValueAsString(values));
        try {
            StoredFileMetadata docxMeta = fileStorageService.storeBytes(docx,
                    "pek-internal-" + report.getId() + "-v" + version.getVersion() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "pek-report-" + report.getId(), String.valueOf(userId));
            version.setDocxFileId(docxMeta.fileId());
            StoredFileMetadata pdfMeta = fileStorageService.storeBytes(pdf,
                    "pek-internal-" + report.getId() + "-v" + version.getVersion() + ".pdf",
                    "application/pdf", "pek-report-" + report.getId(), String.valueOf(userId));
            version.setPdfFileId(pdfMeta.fileId());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить внутренние аналитические документы ПЭК: " + e.getMessage());
        }
        version.setContentHash(sha256Hex(pdf));
        return versionRepository.saveAndFlush(version);
    }

    /** Generates DOCX only, creating (or reusing the current draft slot of) a new document version.
     *  Kept for backwards compatibility - delegates to official document generation. */
    @Transactional
    public PekReportDocumentVersion generateDocx(Long reportId, Long userId) {
        return generateOfficialDocx(reportId, userId);
    }

    /** Generates both DOCX and its PDF conversion as a single new version - the normal path used
     *  before signing, since signing verifies the CMS against the PDF bytes. Delegates to official. */
    @Transactional
    public PekReportDocumentVersion generatePdf(Long reportId, Long userId) {
        return generateOfficialPdf(reportId, userId);
    }

    /** Backward-compatible overload: an absent documentType means OFFICIAL, never "the newest
     *  document of any type" - see PekReportDocumentVersionRepository#findByReportIdOrderByVersionDesc. */
    @Transactional(readOnly = true)
    public List<PekReportDocumentVersion> listVersions(Long reportId) {
        return listVersions(reportId, kz.eco.pek.PekReportDocumentType.OFFICIAL);
    }

    @Transactional(readOnly = true)
    public List<PekReportDocumentVersion> listVersions(Long reportId, kz.eco.pek.PekReportDocumentType documentType) {
        getReport(reportId);
        kz.eco.pek.PekReportDocumentType type =
                documentType == null ? kz.eco.pek.PekReportDocumentType.OFFICIAL : documentType;
        return versionRepository.findByReportIdAndDocumentTypeOrderByVersionDesc(reportId, type);
    }

    @Transactional(readOnly = true)
    public PekReportDocumentVersion latestVersion(Long reportId) {
        return latestVersion(reportId, kz.eco.pek.PekReportDocumentType.OFFICIAL);
    }

    /**
     * The newest version of exactly one document type. When OFFICIAL is asked for and only
     * INTERNAL versions exist, the error is the specific
     * {@code PEK_REPORT_NO_OFFICIAL_DOCUMENT} - an internal analytical document must never stand
     * in for the state-facing report.
     */
    @Transactional(readOnly = true)
    public PekReportDocumentVersion latestVersion(Long reportId, kz.eco.pek.PekReportDocumentType documentType) {
        kz.eco.pek.PekReportDocumentType type =
                documentType == null ? kz.eco.pek.PekReportDocumentType.OFFICIAL : documentType;
        return versionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, type)
                .orElseThrow(() -> {
                    if (type == kz.eco.pek.PekReportDocumentType.OFFICIAL
                            && versionRepository.existsByReportIdAndDocumentType(
                                    reportId, kz.eco.pek.PekReportDocumentType.INTERNAL)) {
                        return new NotFoundException(
                                "Для отчёта ПЭК сформирован только внутренний документ - официальный документ отсутствует",
                                "PEK_REPORT_NO_OFFICIAL_DOCUMENT");
                    }
                    return new NotFoundException("Для отчёта ПЭК ещё не сформирован ни один документ");
                });
    }

    /** Optional lookup used where "no document yet" is a normal state (readiness, availableActions). */
    @Transactional(readOnly = true)
    public java.util.Optional<PekReportDocumentVersion> findLatestOfficial(Long reportId) {
        return versionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(
                reportId, kz.eco.pek.PekReportDocumentType.OFFICIAL);
    }

    @Transactional(readOnly = true)
    public PekReportDocumentVersion getVersion(Long reportId, Long versionId) {
        PekReportDocumentVersion v = versionRepository.findById(versionId)
                .orElseThrow(() -> new NotFoundException("Версия документа не найдена: " + versionId));
        if (!v.getReportId().equals(reportId)) {
            throw new NotFoundException("Версия документа не найдена: " + versionId);
        }
        return v;
    }

    /** Same ownership check plus, when the caller states a documentType, that the version really is
     *  of that type - so a caller asking for the OFFICIAL version by id can never be handed an
     *  INTERNAL one. */
    @Transactional(readOnly = true)
    public PekReportDocumentVersion getVersion(Long reportId, Long versionId,
                                                kz.eco.pek.PekReportDocumentType documentType) {
        PekReportDocumentVersion v = getVersion(reportId, versionId);
        if (documentType != null && v.getDocumentType() != documentType) {
            throw new NotFoundException("Версия документа не найдена: " + versionId,
                    "PEK_DOCUMENT_TYPE_MISMATCH");
        }
        return v;
    }

    /** Regeneration (and first generation) is blocked once the report has been signed or archived -
     *  a signed document must remain exactly the artifact that was actually signed. */
    public void requireRegenerationAllowed(PekReport report) {
        if (report.getStatus() == kz.eco.pek.PekReportStatus.SIGNED
                || report.getStatus() == kz.eco.pek.PekReportStatus.ARCHIVED) {
            throw new ConflictException(
                    "Документ отчёта нельзя перегенерировать после подписания", "PEK_REPORT_DOCUMENT_LOCKED");
        }
    }

    private PekReportDocumentVersion newVersionTyped(PekReport report, Object snapshotValues,
                                                      Long userId, kz.eco.pek.PekReportDocumentType docType,
                                                      String snapshotJson) {
        int nextVersion = versionRepository.findTopByReportIdOrderByVersionDesc(report.getId())
                .map(v -> v.getVersion() + 1).orElse(1);
        PekReportDocumentVersion version = new PekReportDocumentVersion();
        version.setReportId(report.getId());
        version.setVersion(nextVersion);
        version.setDocumentType(docType);
        version.setRegulationVersion(report.getRegulationVersion());
        version.setTemplateVersion(report.getTemplateVersion());
        version.setSourceContentRevision(report.getContentRevision());
        version.setSnapshotJson(snapshotJson);
        version.setGeneratedAt(LocalDateTime.now());
        version.setGeneratedBy(userId);
        return version;
    }

    private OfficialPekReportDocValues buildOfficialValues(PekReport report) {
        var base = buildCommonData(report);
        String reportNumber = report.getId() + "/" + report.getPeriodKey();
        int nextVersion = versionRepository.findTopByReportIdOrderByVersionDesc(report.getId())
                .map(v -> v.getVersion() + 1).orElse(1);

        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);
        PekProgram program = programRepository.findById(report.getProgramId()).orElse(null);

        // Administrative data comes from the program's facility snapshot first, falling back to the
        // live company/object rows only where the snapshot has nothing. A report must describe the
        // facility as it was declared, not as it has since been edited.
        var general = new OfficialPekReportDocValues.GeneralInfo(
                company == null ? null : company.getName(),
                firstNonBlank(program == null ? null : program.getBinSnapshot(), company == null ? null : company.getBin()),
                company == null ? null : company.getLegalAddress(),
                company == null ? null : company.getActualAddress(),
                company == null ? null : company.getPhone(),
                object == null ? null : object.getName(),
                object == null ? null : object.getAddress(),
                program == null ? null : program.getKato(),
                program == null ? null : program.getOked(),
                program == null ? null : program.getEnvironmentalCategory(),
                object == null ? null : object.getCoordinates(),
                program == null ? null : program.getProductionCharacteristics(),
                program == null ? null : program.getDesignCapacity(),
                program == null ? null : program.getActualCapacity(),
                program == null ? null : program.getNumber(),
                program == null ? null : program.getName(),
                program == null || program.getValidFrom() == null ? null : program.getValidFrom().toString(),
                program == null || program.getValidUntil() == null ? null : program.getValidUntil().toString());

        List<PekProgramMonitoring> directions = program == null ? List.of()
                : monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId());
        Map<Long, List<PekMonitoringPoint>> pointsByDirection = program == null ? Map.of()
                : monitoringPointRepository.findByProgramIdOrderByIdAsc(program.getId()).stream()
                        .collect(Collectors.groupingBy(PekMonitoringPoint::getMonitoringId));
        List<OfficialPekReportDocValues.MonitoringRow> monitoringRows = directions.stream()
                .map(d -> {
                    List<PekMonitoringPoint> points = pointsByDirection.getOrDefault(d.getId(), List.of());
                    return new OfficialPekReportDocValues.MonitoringRow(
                            d.getMonitoringType() == null ? null : d.getMonitoringType().name(),
                            d.getName(), d.getMethodology(),
                            d.getFrequencyType() == null ? null : d.getFrequencyType().name(),
                            points.size(),
                            points.stream().map(PekMonitoringPoint::getName).collect(Collectors.joining(", ")));
                })
                .toList();

        // Applicability, identical to the rule program readiness uses: a component section belongs
        // in the report only if the program declares that component.
        Set<PekMonitoringType> declared = directions.stream()
                .map(PekProgramMonitoring::getMonitoringType)
                .collect(Collectors.toSet());
        boolean air = declared.contains(PekMonitoringType.AMBIENT_AIR)
                || declared.contains(PekMonitoringType.EMISSION_SOURCE);
        boolean water = declared.contains(PekMonitoringType.WASTEWATER)
                || declared.contains(PekMonitoringType.SURFACE_WATER)
                || declared.contains(PekMonitoringType.GROUNDWATER);
        boolean waste = declared.contains(PekMonitoringType.WASTE);

        List<OfficialPekReportDocValues.EmissionSourceRow> emissionRows = !air || program == null ? List.of()
                : emissionSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).stream()
                        .map(s -> new OfficialPekReportDocValues.EmissionSourceRow(
                                s.getCode(), s.getName(), s.getSourceType(), s.getWorkshopName(),
                                plain(s.getHeightM()), plain(s.getDiameterM()), s.getCoordinates(),
                                s.getGasCleaningEquipment(), plain(s.getCleaningEfficiencyPercent()),
                                s.getOperatingHoursPerYear() == null ? null : s.getOperatingHoursPerYear().toString()))
                        .toList();

        List<OfficialPekReportDocValues.DischargeSourceRow> dischargeRows = !water || program == null ? List.of()
                : dischargeSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).stream()
                        .map(s -> new OfficialPekReportDocValues.DischargeSourceRow(
                                s.getCode(), s.getName(), s.getReceivingWaterBody(), s.getDischargeType(),
                                s.getCoordinates(), plain(s.getPermittedVolume()), s.getVolumeUnit(),
                                s.getTreatmentFacilities()))
                        .toList();

        List<OfficialPekReportDocValues.WasteRow> wasteRows = !waste || program == null ? List.of()
                : buildWasteRows(report, program);

        return new OfficialPekReportDocValues(
                reportNumber, nextVersion,
                report.getRegulationCode(), report.getRegulationVersion(), report.getTemplateVersion(),
                report.getReportType() == null ? null : report.getReportType().name(),
                report.getPeriodType() == null ? null : report.getPeriodType().name(),
                report.getPeriodStart() == null ? null : report.getPeriodStart().toString(),
                report.getPeriodEnd() == null ? null : report.getPeriodEnd().toString(),
                report.getSubmissionDueDate() == null ? null : report.getSubmissionDueDate().toString(),
                LocalDateTime.now().format(DT),
                general, base.permitRows(), monitoringRows,
                air, emissionRows, water, dischargeRows, waste, wasteRows,
                base.planFactRows(), base.exceedanceRows(), base.protocolRows(),
                base.responsibleUserName(),
                company == null ? null : company.getDirectorName());
    }

    /**
     * Joins the program's waste catalogue with this period's movements. The catalogue drives the
     * row set, so a declared waste type with no figures still appears (with empty movement cells)
     * rather than silently dropping out of the report.
     */
    private List<OfficialPekReportDocValues.WasteRow> buildWasteRows(PekReport report, PekProgram program) {
        Map<Long, PekReportWasteMovement> movements = wasteMovementRepository
                .findByReportIdOrderByIdAsc(report.getId()).stream()
                .collect(Collectors.toMap(PekReportWasteMovement::getWasteItemId, m -> m, (a, b) -> a));
        return wasteItemRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).stream()
                .map(item -> {
                    PekReportWasteMovement m = movements.get(item.getId());
                    return new OfficialPekReportDocValues.WasteRow(
                            item.getName(), item.getCode(), item.getHazardClass(),
                            plain(item.getAccumulationLimit()), item.getLimitUnit(),
                            item.getAccumulationPeriodDays() == null ? null : item.getAccumulationPeriodDays().toString(),
                            item.getStorageSiteName(), item.getCoordinates(),
                            m == null ? null : plain(m.getOpeningBalance()),
                            m == null ? null : plain(m.getGenerated()),
                            m == null ? null : plain(m.getTransferred()),
                            m == null ? null : plain(m.getDisposed()),
                            m == null ? null : plain(m.getClosingBalance()),
                            m == null ? null : m.getReceiverName(),
                            m == null ? null : m.getReceiverBin(),
                            m == null || m.reconciles());
                })
                .toList();
    }

    private static String plain(java.math.BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros().toPlainString();
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private InternalPekAnalyticalDocValues buildInternalValues(PekReport report) {
        var base = buildCommonData(report);
        String reportNumber = report.getId() + "/" + report.getPeriodKey();
        int nextVersion = versionRepository.findTopByReportIdOrderByVersionDesc(report.getId())
                .map(v -> v.getVersion() + 1).orElse(1);
        int total = base.planFactRows().size();
        int completed = (int) base.planFactRows().stream()
                .filter(r -> r.actual() >= r.planned()).count();
        int completionPct = total == 0 ? 0 : (int) Math.round(completed * 100.0 / total);
        int totalExceedances = base.exceedanceRows().size();
        return new InternalPekAnalyticalDocValues(
                reportNumber, nextVersion, report.getRegulationVersion(),
                base.companyName(), base.companyBin(), base.objectName(), base.programName(),
                report.getPeriodType() == null ? null : report.getPeriodType().name(),
                report.getPeriodStart() == null ? null : report.getPeriodStart().toString(),
                report.getPeriodEnd() == null ? null : report.getPeriodEnd().toString(),
                base.responsibleUserName(), LocalDateTime.now().format(DT),
                total, completed, completionPct, totalExceedances,
                base.planFactRows(), base.exceedanceRows(), base.protocolRows());
    }

    private record CommonDocData(String companyName, String companyBin, String objectName,
                                  String programName, String responsibleUserName,
                                  List<PekReportDocValues.PermitRow> permitRows,
                                  List<PekReportDocValues.PlanFactRow> planFactRows,
                                  List<PekReportDocValues.ExceedanceRow> exceedanceRows,
                                  List<PekReportDocValues.ProtocolRow> protocolRows) {}

    private CommonDocData buildCommonData(PekReport report) {
        kz.eco.company.Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        kz.eco.company.CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);
        PekProgram program = programRepository.findById(report.getProgramId()).orElse(null);
        kz.eco.user.User responsible = report.getResponsibleUserId() == null ? null
                : userRepository.findById(report.getResponsibleUserId()).orElse(null);

        List<PekEnvironmentalPermit> permits = permitRepository.findByObjectIdOrderByValidToDesc(report.getObjectId());
        List<PekReportDocValues.PermitRow> permitRows = permits.stream()
                .map(p -> new PekReportDocValues.PermitRow(p.getType() == null ? null : p.getType().toString(),
                        p.getNumber(), p.getValidTo() == null ? null : p.getValidTo().toString(),
                        p.getStatus() == null ? null : p.getStatus().name()))
                .toList();

        List<PekReportPlanFactRow> planFact = planFactRowRepository.findByReportIdOrderByControlItemIdAsc(report.getId());
        java.util.Map<Long, PekProgramControlItem> controlItems = new java.util.HashMap<>();
        controlItemRepository.findAllById(planFact.stream().map(PekReportPlanFactRow::getControlItemId).distinct().toList())
                .forEach(ci -> controlItems.put(ci.getId(), ci));
        List<PekReportDocValues.PlanFactRow> planFactRows = planFact.stream()
                .map(row -> new PekReportDocValues.PlanFactRow(
                        controlItems.containsKey(row.getControlItemId()) ? controlItems.get(row.getControlItemId()).getName() : ("#" + row.getControlItemId()),
                        row.getPlannedCount(), row.getActualCount(),
                        row.getCompletionPercent() == null ? "-" : row.getCompletionPercent().toPlainString(),
                        row.getExceedanceCount()))
                .toList();

        List<PekReportExceedance> exceedances = exceedanceRepository.findByReportId(report.getId());
        List<PekReportDocValues.ExceedanceRow> exceedanceRows = exceedances.stream()
                .map(e -> new PekReportDocValues.ExceedanceRow(
                        "показатель #" + e.getProgramIndicatorId(),
                        e.getActualValue() == null ? null : e.getActualValue().toPlainString(),
                        e.getNormativeValue() == null ? null : e.getNormativeValue().toPlainString(),
                        e.getExceedanceRatio() == null ? null : e.getExceedanceRatio().toPlainString(),
                        e.getStatus() == null ? null : e.getStatus().name(), e.getCorrectiveAction()))
                .toList();

        List<PekReportProtocolSource> sources = sourceRepository.findByReportIdAndExcludedFalse(report.getId());
        List<Long> protocolIds = sources.stream().map(PekReportProtocolSource::getProtocolId).distinct().toList();
        List<PekReportDocValues.ProtocolRow> protocolRows = protocolRepository.findAllById(protocolIds).stream()
                .map(p -> new PekReportDocValues.ProtocolRow(p.getProtocolNumber(),
                        p.getProtocolDate() == null ? null : p.getProtocolDate().toString(), p.getLaboratoryName()))
                .toList();

        return new CommonDocData(
                company == null ? null : company.getName(),
                company == null ? null : company.getBin(),
                object == null ? null : object.getName(),
                program == null ? null : program.getName(),
                responsible == null ? null : responsible.getName(),
                permitRows, planFactRows, exceedanceRows, protocolRows);
    }

    private PekReportDocumentVersion newVersion(PekReport report, PekReportDocValues values, Long userId) {
        return newVersionTyped(report, values, userId, kz.eco.pek.PekReportDocumentType.OFFICIAL,
                objectMapper.writeValueAsString(values));
    }

    private PekReportDocValues buildValues(PekReport report) {
        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = companyObjectRepository.findById(report.getObjectId()).orElse(null);
        PekProgram program = programRepository.findById(report.getProgramId()).orElse(null);
        User responsible = report.getResponsibleUserId() == null ? null
                : userRepository.findById(report.getResponsibleUserId()).orElse(null);

        List<PekEnvironmentalPermit> permits = permitRepository.findByObjectIdOrderByValidToDesc(report.getObjectId());
        List<PekReportDocValues.PermitRow> permitRows = permits.stream()
                .map(p -> new PekReportDocValues.PermitRow(p.getType() == null ? null : p.getType().toString(),
                        p.getNumber(), p.getValidTo() == null ? null : p.getValidTo().toString(),
                        p.getStatus() == null ? null : p.getStatus().name()))
                .toList();

        List<PekReportPlanFactRow> planFact = planFactRowRepository.findByReportIdOrderByControlItemIdAsc(report.getId());
        java.util.Map<Long, PekProgramControlItem> controlItems = new java.util.HashMap<>();
        controlItemRepository.findAllById(planFact.stream().map(PekReportPlanFactRow::getControlItemId).distinct().toList())
                .forEach(ci -> controlItems.put(ci.getId(), ci));
        List<PekReportDocValues.PlanFactRow> planFactRows = planFact.stream()
                .map(row -> new PekReportDocValues.PlanFactRow(
                        controlItems.containsKey(row.getControlItemId()) ? controlItems.get(row.getControlItemId()).getName() : ("#" + row.getControlItemId()),
                        row.getPlannedCount(), row.getActualCount(),
                        row.getCompletionPercent() == null ? "-" : row.getCompletionPercent().toPlainString(),
                        row.getExceedanceCount()))
                .toList();

        List<PekReportExceedance> exceedances = exceedanceRepository.findByReportId(report.getId());
        List<PekReportDocValues.ExceedanceRow> exceedanceRows = exceedances.stream()
                .map(e -> new PekReportDocValues.ExceedanceRow(
                        "показатель #" + e.getProgramIndicatorId(),
                        e.getActualValue() == null ? null : e.getActualValue().toPlainString(),
                        e.getNormativeValue() == null ? null : e.getNormativeValue().toPlainString(),
                        e.getExceedanceRatio() == null ? null : e.getExceedanceRatio().toPlainString(),
                        e.getStatus() == null ? null : e.getStatus().name(), e.getCorrectiveAction()))
                .toList();

        List<PekReportProtocolSource> sources = sourceRepository.findByReportIdAndExcludedFalse(report.getId());
        List<Long> protocolIds = sources.stream().map(PekReportProtocolSource::getProtocolId).distinct().toList();
        List<PekReportDocValues.ProtocolRow> protocolRows = protocolRepository.findAllById(protocolIds).stream()
                .map(p -> new PekReportDocValues.ProtocolRow(p.getProtocolNumber(),
                        p.getProtocolDate() == null ? null : p.getProtocolDate().toString(), p.getLaboratoryName()))
                .toList();

        String reportNumber = report.getId() + "/" + report.getPeriodKey();
        int nextVersion = versionRepository.findTopByReportIdOrderByVersionDesc(report.getId())
                .map(v -> v.getVersion() + 1).orElse(1);

        return new PekReportDocValues(
                reportNumber, nextVersion,
                company == null ? null : company.getName(), company == null ? null : company.getBin(),
                object == null ? null : object.getName(), program == null ? null : program.getName(),
                report.getPeriodType() == null ? null : report.getPeriodType().name(),
                report.getPeriodStart() == null ? null : report.getPeriodStart().toString(),
                report.getPeriodEnd() == null ? null : report.getPeriodEnd().toString(),
                responsible == null ? null : responsible.getName(),
                LocalDateTime.now().format(DT),
                permitRows, planFactRows, exceedanceRows, protocolRows);
    }

    private PekReport getReport(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
