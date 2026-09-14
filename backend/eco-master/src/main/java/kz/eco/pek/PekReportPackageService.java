package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.docgen.PekProgramDocumentGenerationService;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
import kz.eco.pek.dto.PekMonitoringDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class PekReportPackageService {

    private final PekReportRepository reports;
    private final PekProgramRepository programs;
    private final PekProgramMonitoringRepository monitoring;
    private final PekReportPackageRepository packages;
    private final PekMonitoringExcelGenerationService excel;
    private final PekReportDocumentGenerationService finalDocs;
    private final PekReportProtocolSourceRepository sources;
    private final ProtocolRepository protocols;
    private final FileStorageService storage;
    private final ObjectMapper json;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekProgramDocumentGenerationService programDocs;
    private final PekPackagePolicy packagePolicy;

    public PekReportPackageService(PekReportRepository reports, PekProgramRepository programs,
                                    PekProgramMonitoringRepository monitoring, PekReportPackageRepository packages,
                                    PekMonitoringExcelGenerationService excel, PekReportDocumentGenerationService finalDocs,
                                    PekReportProtocolSourceRepository sources, ProtocolRepository protocols,
                                    FileStorageService storage, ObjectMapper json,
                                    PekReportContentRevisionService contentRevisionService,
                                    PekProgramDocumentGenerationService programDocs,
                                    PekPackagePolicy packagePolicy) {
        this.reports = reports;
        this.programs = programs;
        this.monitoring = monitoring;
        this.packages = packages;
        this.excel = excel;
        this.finalDocs = finalDocs;
        this.sources = sources;
        this.protocols = protocols;
        this.storage = storage;
        this.json = json;
        this.contentRevisionService = contentRevisionService;
        this.programDocs = programDocs;
        this.packagePolicy = packagePolicy;
    }

    /**
     * Builds a new package version.
     *
     * <p>{@code expectedReportVersion} is the REPORT's optimistic-lock {@code @Version}, taken from
     * the caller's If-Match header - not the package's {@code documentVersion} (which counts
     * packages built for this report) and not {@code contentRevision} (which counts content
     * changes). The three are unrelated counters and must not be substituted for one another.
     *
     * <p>The report row is taken under a real {@code SELECT ... FOR UPDATE} before the version is
     * compared, so two concurrent generations serialize instead of both reading the same
     * "latest documentVersion" and racing. Comparing versions without the lock would not be enough:
     * both callers could hold the same valid version, both pass the check, and both then compute
     * {@code documentVersion = n + 1}. The unique constraint on (report_id, document_version) is
     * the second line of defence, not the first.
     *
     * <p>Everything is validated before any file is written: a rejected call leaves no stored blob
     * and no package row.
     */
    @Transactional
    public PekMonitoringDtos.PackageResponse generate(Long reportId, Long userId, Long expectedReportVersion) {
        if (expectedReportVersion == null) {
            throw new BadRequestException(
                    "Требуется заголовок If-Match с версией отчёта", "VERSION_REQUIRED");
        }
        // Pessimistic lock first, THEN the version comparison - see the javadoc above for why the
        // comparison alone cannot make this atomic.
        PekReport report = reports.findByIdForUpdate(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        if (!expectedReportVersion.equals(report.getVersion())) {
            throw ConflictException.versionConflict(
                    "Отчёт был изменён другим сотрудником - обновите данные и повторите формирование",
                    "PEK_VERSION_CONFLICT", report.getVersion());
        }
        packagePolicy.requireCanGenerate(report);

        PekProgram program = programs.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
        var dirs = monitoring.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId());
        if (dirs.isEmpty()) {
            throw new ConflictException("В программе нет включённых направлений мониторинга", "PEK_MONITORING_EMPTY");
        }

        // Recomputed from the CURRENT source data on every call - never seeded from the previous
        // package's missingFieldsJson. Fixing what a past package complained about and generating
        // again is exactly the intended workflow, so a stored complaint must never gate a rebuild.
        List<String> missing = new ArrayList<>();
        Map<String, byte[]> files = new LinkedHashMap<>();
        for (var d : dirs) {
            if (d.getControlItemIds().isEmpty()) missing.add(d.getMonitoringType() + ".controlItemIds");
            if (d.getMethodology() == null || d.getMethodology().isBlank()) missing.add(d.getMonitoringType() + ".methodology");
            put(files, excel.fileName(d.getMonitoringType()), excel.generate(d));
        }
        // The program document is rendered from the program itself (all sections, both DOCX and
        // PDF from the same source), not assembled inline here from a few paragraphs - see
        // PekProgramDocumentGenerationService for what the previous placeholder left out.
        byte[] programDocx = programDocs.renderDocx(program.getId());
        put(files, "Программа_и_план_ПЭК.docx", programDocx);
        put(files, "Программа_и_план_ПЭК.pdf", programDocs.renderPdfFrom(programDocx));

        // NOTE: generatePdf() creates a NEW PekReportDocumentVersion row (bumping document-version
        // history) as a SIDE EFFECT of building the package - it always regenerates, never reuses
        // the latest existing version.
        var finalVersion = finalDocs.generatePdf(reportId, userId);
        addStored(files, "Итоговый_отчёт_ПЭК.docx", finalVersion.getDocxFileId());
        addStored(files, "Итоговый_отчёт_ПЭК.pdf", finalVersion.getPdfFileId());

        Set<Long> protocolIds = new LinkedHashSet<>();
        for (var s : sources.findByReportIdAndExcludedFalse(reportId)) protocolIds.add(s.getProtocolId());
        for (Protocol p : protocols.findAllById(protocolIds)) {
            if (p.getPdfFileId() != null) {
                addStored(files, protocolEntryName(p), p.getPdfFileId());
            } else {
                missing.add("protocols[" + p.getId() + "].pdf");
            }
        }

        int version = packages.findTopByReportIdOrderByDocumentVersionDesc(reportId)
                .map(v -> v.getDocumentVersion() + 1).orElse(1);
        byte[] zip = zip(files);
        try {
            var meta = storage.storeBytes(zip, "ПЭК_полный_комплект_" + reportId + "_v" + version + ".zip",
                    "application/zip", "pek-package-" + reportId, String.valueOf(userId));
            PekReportPackage entity = new PekReportPackage();
            entity.setReportId(reportId);
            entity.setDocumentVersion(version);
            // Re-read the report's contentRevision AFTER generatePdf() (which itself doesn't bump
            // it, but nothing here should assume that never changes) - this is what download()
            // checks against, not the JPA version.
            entity.setSourceContentRevision(report.getContentRevision());
            entity.setSnapshotJson(json.writeValueAsString(files.keySet()));
            entity.setMissingFieldsJson(json.writeValueAsString(missing));
            entity.setZipFileId(meta.fileId());
            entity.setGeneratedBy(userId);
            return dto(packages.saveAndFlush(entity), new ArrayList<>(files.keySet()), missing, report);
        } catch (IOException ex) {
            throw new BadRequestException("Не удалось сохранить комплект ПЭК: " + ex.getMessage());
        }
    }

    /**
     * The most recently built package. Its {@code missingFields} is the snapshot stored with that
     * build, deliberately returned as-is: it says what was missing from the archive the caller can
     * download, which is a different question from whether the report is complete right now. See
     * {@link PekMonitoringDtos.PackageResponse} for the distinction, and note that generating again
     * never consults it.
     */
    @Transactional(readOnly = true)
    public PekMonitoringDtos.PackageResponse latest(Long id) {
        PekReport report = report(id);
        var p = latestEntity(id);
        return dto(p, readList(p.getSnapshotJson()), readList(p.getMissingFieldsJson()), report);
    }

    @Transactional(readOnly = true)
    public StoredFileContent download(Long id) throws IOException {
        PekReport report = report(id);
        PekReportPackage entity = latestEntity(id);
        // Module fix item 3: a package generated before a later report-content edit (protocol
        // source rematch, plan/fact recompute, exceedance/evidence change, permit change,
        // monitoring change) must not be downloaded as if it were current.
        contentRevisionService.requireCurrent(entity.getSourceContentRevision(), report);
        return storage.load(entity.getZipFileId());
    }

    private PekReportPackage latestEntity(Long id) {
        return packages.findTopByReportIdOrderByDocumentVersionDesc(id)
                .orElseThrow(() -> new NotFoundException("Комплект ПЭК ещё не сформирован"));
    }

    private PekReport report(Long id) {
        return reports.findById(id).orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + id));
    }

    private void addStored(Map<String, byte[]> files, String name, String id) {
        if (id == null) return;
        try (var in = storage.load(id).inputStream()) {
            put(files, name, in.readAllBytes());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось включить документ в комплект: " + name);
        }
    }

    /**
     * Adds one entry, refusing to overwrite a path that is already taken.
     *
     * <p>A plain {@code Map.put} silently dropped a file whenever two entries produced the same
     * path, and the manifest (built from {@code files.keySet()}) then agreed with the ZIP, so the
     * loss left no trace anywhere. Protocol names are the case that actually bit: {@code A/1} and
     * {@code A:1} both sanitise to {@code A_1}. That specific collision is fixed by putting the
     * protocol id in the name, but a package that quietly ships fewer documents than it lists is
     * worth failing loudly for whatever the cause.
     */
    private void put(Map<String, byte[]> files, String name, byte[] content) {
        if (files.containsKey(name)) {
            throw new ConflictException(
                    "Повторяющееся имя файла в комплекте ПЭК: " + name, "PEK_PACKAGE_DUPLICATE_ENTRY");
        }
        files.put(name, content);
    }

    /**
     * {@code Протоколы/<номер>_<id>.pdf}. The id is what makes it unique: sanitising strips the
     * characters that are illegal in a ZIP path, and different numbers routinely collapse onto the
     * same sanitised string. A blank or missing number falls back to {@code protocol}, so such a
     * protocol is still distinguishable by its id rather than colliding with every other unnamed one.
     */
    private String protocolEntryName(Protocol p) {
        return "Протоколы/" + safe(p.getProtocolNumber()) + "_" + p.getId() + ".pdf";
    }

    private byte[] zip(Map<String, byte[]> files) {
        try (var out = new ByteArrayOutputStream(); var z = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            for (var e : files.entrySet()) {
                z.putNextEntry(new ZipEntry(e.getKey()));
                z.write(e.getValue());
                z.closeEntry();
            }
            z.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> readList(String s) {
        try {
            return json.readValue(s, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    private PekMonitoringDtos.PackageResponse dto(PekReportPackage p, List<String> files, List<String> missing,
                                                    PekReport report) {
        boolean downloadAvailable = p.getZipFileId() != null;
        boolean current = p.getSourceContentRevision() == null
                || p.getSourceContentRevision().equals(report.getContentRevision());

        Map<String, Boolean> actions = new LinkedHashMap<>();
        // Same computation ReportResponse.availableActions uses and the same one generate()
        // enforces - previously this said "true" for any editor role, including on a SIGNED report
        // whose generation the very next call would refuse.
        actions.put("generatePackage", packagePolicy.canGenerate(report));
        actions.put("downloadPackage", downloadAvailable && current);
        return new PekMonitoringDtos.PackageResponse(p.getId(), p.getReportId(), p.getDocumentVersion(),
                p.getSourceContentRevision(), files, missing, p.getGeneratedAt().toString(), p.getGeneratedBy(),
                downloadAvailable, actions, p.getVersion());
    }

    /**
     * Makes one path segment safe for a ZIP entry while leaving Unicode (Cyrillic protocol numbers)
     * intact - the archive is written with a UTF-8 {@link ZipOutputStream}, so only path-structural
     * and control characters need replacing, not non-ASCII ones.
     */
    private String safe(String v) {
        String trimmed = v == null ? "" : v.trim();
        if (trimmed.isEmpty()) {
            return "protocol";
        }
        return trimmed.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
    }
}
