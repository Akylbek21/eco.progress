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
import kz.eco.user.User;
import kz.eco.user.UserRole;
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

    private static final Set<UserRole> EDIT_ROLES =
            Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST, UserRole.LABORATORY);

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

    public PekReportPackageService(PekReportRepository reports, PekProgramRepository programs,
                                    PekProgramMonitoringRepository monitoring, PekReportPackageRepository packages,
                                    PekMonitoringExcelGenerationService excel, PekReportDocumentGenerationService finalDocs,
                                    PekReportProtocolSourceRepository sources, ProtocolRepository protocols,
                                    FileStorageService storage, ObjectMapper json,
                                    PekReportContentRevisionService contentRevisionService,
                                    PekProgramDocumentGenerationService programDocs) {
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
    }

    @Transactional
    public PekMonitoringDtos.PackageResponse generate(Long reportId, Long userId) {
        PekReport report = report(reportId);
        PekProgram program = programs.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
        var dirs = monitoring.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId());
        if (dirs.isEmpty()) {
            throw new ConflictException("В программе нет включённых направлений мониторинга", "PEK_MONITORING_EMPTY");
        }

        List<String> missing = new ArrayList<>();
        Map<String, byte[]> files = new LinkedHashMap<>();
        for (var d : dirs) {
            if (d.getControlItemIds().isEmpty()) missing.add(d.getMonitoringType() + ".controlItemIds");
            if (d.getMethodology() == null || d.getMethodology().isBlank()) missing.add(d.getMonitoringType() + ".methodology");
            files.put(excel.fileName(d.getMonitoringType()), excel.generate(d));
        }
        // The program document is rendered from the program itself (all sections, both DOCX and
        // PDF from the same source), not assembled inline here from a few paragraphs - see
        // PekProgramDocumentGenerationService for what the previous placeholder left out.
        byte[] programDocx = programDocs.renderDocx(program.getId());
        files.put("Программа_и_план_ПЭК.docx", programDocx);
        files.put("Программа_и_план_ПЭК.pdf", programDocs.renderPdfFrom(programDocx));

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
                addStored(files, "Протоколы/" + safe(p.getProtocolNumber()) + ".pdf", p.getPdfFileId());
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
            files.put(name, in.readAllBytes());
        } catch (IOException e) {
            throw new BadRequestException("Не удалось включить документ в комплект: " + name);
        }
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

        User currentUser = kz.eco.auth.CurrentUser.getOrNull();
        UserRole role = currentUser == null ? null : currentUser.getRole();
        boolean canEdit = EDIT_ROLES.contains(role);

        Map<String, Boolean> actions = new LinkedHashMap<>();
        actions.put("generatePackage", canEdit);
        actions.put("downloadPackage", downloadAvailable && current);
        return new PekMonitoringDtos.PackageResponse(p.getId(), p.getReportId(), p.getDocumentVersion(),
                p.getSourceContentRevision(), files, missing, p.getGeneratedAt().toString(), p.getGeneratedBy(),
                downloadAvailable, actions, p.getVersion());
    }

    private String safe(String v) {
        return (v == null ? "protocol" : v).replaceAll("[\\\\/:*?\"<>|]", "_");
    }
}
