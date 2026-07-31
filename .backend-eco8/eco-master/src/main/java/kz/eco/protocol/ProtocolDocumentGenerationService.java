package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.docgen.ProtocolDocxTemplateRenderer;
import kz.eco.protocol.docgen.ProtocolTemplateKey;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;

@Service
public class ProtocolDocumentGenerationService {

    private static final Logger log = LoggerFactory.getLogger(ProtocolDocumentGenerationService.class);

    private final ProtocolRepository protocolRepository;
    private final ProtocolResultRepository resultRepository;
    private final ProtocolEnvironmentConditionsRepository envConditionsRepository;
    private final FileStorageService fileStorageService;
    private final ProtocolAuditService auditService;
    private final ProtocolMutationGuard mutationGuard;

    public ProtocolDocumentGenerationService(ProtocolRepository protocolRepository,
                                               ProtocolResultRepository resultRepository,
                                               ProtocolEnvironmentConditionsRepository envConditionsRepository,
                                               FileStorageService fileStorageService,
                                               ProtocolAuditService auditService,
                                               ProtocolMutationGuard mutationGuard) {
        this.protocolRepository = protocolRepository;
        this.resultRepository = resultRepository;
        this.envConditionsRepository = envConditionsRepository;
        this.fileStorageService = fileStorageService;
        this.auditService = auditService;
        this.mutationGuard = mutationGuard;
    }

    @Transactional(readOnly = true)
    public byte[] generatePreview(Long protocolId) {
        try {
            return buildPdf(protocolId);
        } catch (IOException ex) {
            throw new BadRequestException("Не удалось сформировать preview: " + ex.getMessage());
        }
    }

    @Transactional
    public StoredFileMetadata generateDocx(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getProtocol(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_DOCX);
        byte[] content = buildDocx(protocol);
        String filename = protocol.getProtocolNumber() + ".docx";
        StoredFileMetadata meta = fileStorageService.storeBytes(
                content, filename,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "protocol-" + protocolId, String.valueOf(userId));
        protocol.setDocxFileId(meta.fileId());
        if (protocol.getStatus() == ProtocolStatus.DRAFT || protocol.getStatus() == ProtocolStatus.CALCULATED) {
            protocol.setStatus(ProtocolStatus.READY);
        }
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.DOCX_GENERATED, protocol.getStatus(), protocol.getStatus(), userId, null);
        return meta;
    }

    @Transactional
    public StoredFileMetadata generatePdf(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getProtocol(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_PDF);
        byte[] content = buildPdf(protocolId);
        String filename = protocol.getProtocolNumber() + ".pdf";
        StoredFileMetadata meta = fileStorageService.storeBytes(
                content, filename, "application/pdf",
                "protocol-" + protocolId, String.valueOf(userId));
        protocol.setPdfFileId(meta.fileId());
        if (protocol.getStatus() == ProtocolStatus.DRAFT || protocol.getStatus() == ProtocolStatus.CALCULATED) {
            protocol.setStatus(ProtocolStatus.READY);
        }
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.PDF_GENERATED, protocol.getStatus(), protocol.getStatus(), userId, null);
        return meta;
    }

    /** On-demand render straight from the template, without persisting a stored copy or changing protocol status. */
    @Transactional(readOnly = true)
    public byte[] renderDocx(Long protocolId) throws IOException {
        return buildDocx(getProtocol(protocolId));
    }

    /** On-demand render straight from the template (via DOCX -> PDF conversion), no persistence. */
    @Transactional(readOnly = true)
    public byte[] renderPdf(Long protocolId) throws IOException {
        return buildPdf(protocolId);
    }

    private byte[] buildDocx(Protocol protocol) throws IOException {
        ProtocolTemplateKey key = resolveTemplateKey(protocol);
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        ProtocolEnvironmentConditions env = envConditionsRepository.findByProtocolId(protocol.getId()).orElse(null);
        byte[] logoBytes = null;
        String logoContentType = null;
        String logoFileId = protocol.getLaboratoryLogoFileId();
        if (logoFileId != null && !logoFileId.isBlank()) {
            try {
                StoredFileContent logo = fileStorageService.load(logoFileId);
                logoBytes = logo.inputStream().readAllBytes();
                logoContentType = logo.contentType();
            } catch (IOException ex) {
                // A missing/corrupt logo file must not block protocol generation - render without it.
                log.warn("Не удалось загрузить логотип лаборатории (fileId={}): {}", logoFileId, ex.getMessage());
            }
        }
        return ProtocolDocxTemplateRenderer.render(key, protocol, results, env, logoBytes, logoContentType);
    }

    private byte[] buildPdf(Long protocolId) throws IOException {
        Protocol protocol = getProtocol(protocolId);
        byte[] docx = buildDocx(protocol);
        return convertDocxToPdf(docx);
    }

    private ProtocolTemplateKey resolveTemplateKey(Protocol protocol) {
        ProtocolTemplateKey key = ProtocolTemplateKey.fromTemplateId(protocol.getTemplateCode());
        if (key == null) {
            throw new BadRequestException("Не удалось определить шаблон протокола для типа: " + protocol.getTemplateCode());
        }
        return key;
    }

    private byte[] convertDocxToPdf(byte[] docxBytes) throws IOException {
        java.nio.file.Path tempDir = java.nio.file.Files.createTempDirectory("docx-pdf");
        java.nio.file.Path docxFile = tempDir.resolve("protocol.docx");
        java.nio.file.Path pdfFile = tempDir.resolve("protocol.pdf");
        try {
            java.nio.file.Files.write(docxFile, docxBytes);
            ProcessBuilder pb = new ProcessBuilder(
                    "libreoffice", "--headless", "--convert-to", "pdf",
                    "--outdir", tempDir.toString(), docxFile.toString());
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean finished = process.waitFor(60, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IOException("LibreOffice conversion timeout");
            }
            if (java.nio.file.Files.exists(pdfFile)) {
                return java.nio.file.Files.readAllBytes(pdfFile);
            }
            throw new IOException("PDF file not generated by LibreOffice");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("PDF conversion interrupted", e);
        } finally {
            try {
                java.nio.file.Files.deleteIfExists(pdfFile);
                java.nio.file.Files.deleteIfExists(docxFile);
                java.nio.file.Files.deleteIfExists(tempDir);
            } catch (IOException ignored) {}
        }
    }

    private Protocol getProtocol(Long protocolId) {
        return protocolRepository.findById(protocolId)
                .orElseThrow(() -> new NotFoundException("Протокол не найден: " + protocolId));
    }
}
