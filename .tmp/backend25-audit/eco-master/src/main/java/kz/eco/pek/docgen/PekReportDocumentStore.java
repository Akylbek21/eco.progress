package kz.eco.pek.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.StructuredConflictException;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportDocumentType;
import kz.eco.pek.PekReportDocumentVersion;
import kz.eco.pek.PekReportDocumentVersionRepository;
import kz.eco.pek.PekReportRepository;
import kz.eco.pek.PekReportStatus;
import kz.eco.pek.dto.PekMonitoringDtos;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Persistence side shared by the report-package documents (explanatory note, measures report,
 * emissions table): lock the report, refuse a signed one, append an immutable
 * {@link PekReportDocumentVersion} with its files, and decide whether a stored version is still
 * current. Same rules {@link PekReportDocumentGenerationService} applies to the official report;
 * kept here so each new document service is only "build values, render, store".
 */
@Component
public class PekReportDocumentStore {

    private static final Logger log = LoggerFactory.getLogger(PekReportDocumentStore.class);

    static final String DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    static final String XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /** The bytes of one rendering; any of them may be null except the one the type needs. */
    public record Rendered(byte[] docx, byte[] pdf, byte[] xlsx) {}

    private final PekReportRepository reportRepository;
    private final PekReportDocumentVersionRepository versionRepository;
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    public PekReportDocumentStore(PekReportRepository reportRepository,
                                  PekReportDocumentVersionRepository versionRepository,
                                  FileStorageService fileStorageService, ObjectMapper objectMapper) {
        this.reportRepository = reportRepository;
        this.versionRepository = versionRepository;
        this.fileStorageService = fileStorageService;
        this.objectMapper = objectMapper;
    }

    /**
     * {@code SELECT ... FOR UPDATE} on the report, then the signed-document guard - the same first
     * step, in the same order, as every other generation path, so the shared version counter is
     * read and incremented atomically (see PekReportDocumentGenerationService#lockReport).
     */
    public PekReport lockForGeneration(Long reportId) {
        PekReport report = reportRepository.findByIdForUpdate(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        if (report.getStatus() == PekReportStatus.SIGNED || report.getStatus() == PekReportStatus.ARCHIVED) {
            throw new kz.eco.common.exception.ConflictException(
                    "Документ отчёта нельзя перегенерировать после подписания", "PEK_REPORT_DOCUMENT_LOCKED");
        }
        return report;
    }

    /** Blocking issues stop generation before anything is rendered or stored. */
    public static void requireNoIssues(List<PekMonitoringDtos.PackageIssue> issues, String documentTitle) {
        if (!issues.isEmpty()) {
            throw new StructuredConflictException(
                    "Недостаточно данных для формирования документа «" + documentTitle + "»",
                    "PEK_DOCUMENT_NOT_READY", issues);
        }
    }

    public PekReportDocumentVersion store(PekReport report, PekProgram program, PekReportDocumentType type,
                                          Object snapshot, Rendered rendered, String baseName, Long userId) {
        int next = nextVersion(report.getId());
        PekReportDocumentVersion version = new PekReportDocumentVersion();
        version.setReportId(report.getId());
        version.setVersion(next);
        version.setDocumentType(type);
        version.setRegulationVersion(report.getRegulationVersion());
        version.setTemplateVersion(report.getTemplateVersion());
        version.setSourceContentRevision(report.getContentRevision());
        version.setSourceProgramContentRevision(program == null ? null : program.getContentRevision());
        version.setSnapshotJson(objectMapper.writeValueAsString(snapshot));
        version.setGeneratedAt(LocalDateTime.now());
        version.setGeneratedBy(userId);

        String prefix = baseName + "-" + report.getId() + "-v" + next;
        String owner = "pek-report-" + report.getId();
        try {
            if (rendered.docx() != null) {
                version.setDocxFileId(storeFile(rendered.docx(), prefix + ".docx", DOCX_TYPE, owner, userId));
            }
            if (rendered.pdf() != null) {
                version.setPdfFileId(storeFile(rendered.pdf(), prefix + ".pdf", "application/pdf", owner, userId));
            }
            if (rendered.xlsx() != null) {
                version.setXlsxFileId(storeFile(rendered.xlsx(), prefix + ".xlsx", XLSX_TYPE, owner, userId));
            }
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сохранить документ ПЭК: " + e.getMessage());
        }
        byte[] hashed = rendered.pdf() != null ? rendered.pdf()
                : rendered.docx() != null ? rendered.docx() : rendered.xlsx();
        version.setContentHash(PekReportDocumentGenerationService.sha256Hex(hashed));
        return versionRepository.saveAndFlush(version);
    }

    /** The version number the next stored document of any type will get. Only meaningful while the
     *  caller holds the report lock from {@link #lockForGeneration}. */
    public int nextVersion(Long reportId) {
        return versionRepository.findTopByReportIdOrderByVersionDesc(reportId)
                .map(v -> v.getVersion() + 1).orElse(1);
    }

    public Optional<PekReportDocumentVersion> latest(Long reportId, PekReportDocumentType type) {
        return versionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, type);
    }

    /**
     * A version is stale once the report's content has moved on, or - for documents that print
     * program data - once the program's has. A null stamp means "generated before it was tracked"
     * and is treated as current, the same convention PekReportContentRevisionService uses.
     */
    public static boolean isStale(PekReportDocumentVersion v, PekReport report, PekProgram program) {
        if (v.getSourceContentRevision() != null && !v.getSourceContentRevision().equals(report.getContentRevision())) {
            return true;
        }
        return program != null && v.getSourceProgramContentRevision() != null
                && v.getSourceProgramContentRevision() != program.getContentRevision();
    }

    private String storeFile(byte[] bytes, String name, String contentType, String owner, Long userId)
            throws IOException {
        StoredFileMetadata meta = fileStorageService.storeBytes(bytes, name, contentType, owner, String.valueOf(userId));
        deleteOnRollback(meta.fileId());
        return meta.fileId();
    }

    /** Files are written before the version row commits; a rollback would otherwise orphan them. */
    private void deleteOnRollback(String fileId) {
        if (fileId == null || !TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_ROLLED_BACK) return;
                try {
                    fileStorageService.delete(fileId);
                } catch (RuntimeException ex) {
                    log.warn("Не удалось удалить файл-сироту {} после отката транзакции", fileId, ex);
                }
            }
        });
    }
}
