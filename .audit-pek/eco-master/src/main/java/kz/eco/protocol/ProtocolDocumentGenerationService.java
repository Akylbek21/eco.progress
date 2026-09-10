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
import java.security.MessageDigest;
import java.util.HexFormat;
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
    private final ProtocolContentVersionService contentVersionService;
    private final ProtocolSamplingPointRepository samplingPointRepository;

    public ProtocolDocumentGenerationService(ProtocolRepository protocolRepository,
                                               ProtocolResultRepository resultRepository,
                                               ProtocolEnvironmentConditionsRepository envConditionsRepository,
                                               FileStorageService fileStorageService,
                                               ProtocolAuditService auditService,
                                               ProtocolMutationGuard mutationGuard,
                                               ProtocolContentVersionService contentVersionService,
                                               ProtocolSamplingPointRepository samplingPointRepository) {
        this.protocolRepository = protocolRepository;
        this.resultRepository = resultRepository;
        this.envConditionsRepository = envConditionsRepository;
        this.fileStorageService = fileStorageService;
        this.auditService = auditService;
        this.mutationGuard = mutationGuard;
        this.contentVersionService = contentVersionService;
        this.samplingPointRepository = samplingPointRepository;
    }

    /** {@code fallback} = true when {@code bytes} came from the OpenPDF fallback renderer
     *  (LibreOffice unavailable/failed), not a real LibreOffice conversion. */
    private record PdfBuildResult(byte[] bytes, boolean fallback) {
    }

    @Transactional(readOnly = true)
    public byte[] generatePreview(Long protocolId) {
        try {
            return buildPdf(protocolId).bytes();
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
        // Module spec §12: generation must never change workflow status as a side effect -
        // protocols move forward exclusively via the explicit ready-for-approval/approve/sign
        // commands, never as a byproduct of generating a document.
        protocol.setDocxFileId(meta.fileId());
        contentVersionService.bump(protocol);
        auditService.log(protocolId, ProtocolAuditAction.DOCX_GENERATED, protocol.getStatus(), protocol.getStatus(), userId, null);
        return meta;
    }

    @Transactional
    public StoredFileMetadata generatePdf(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getProtocol(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_PDF);
        PdfBuildResult built = buildPdf(protocolId);
        String filename = protocol.getProtocolNumber() + ".pdf";
        StoredFileMetadata meta = fileStorageService.storeBytes(
                built.bytes(), filename, "application/pdf",
                "protocol-" + protocolId, String.valueOf(userId));
        protocol.setPdfFileId(meta.fileId());
        protocol.setPdfIsFallback(built.fallback());
        // P1 module fix item 8: hash the PDF at the moment it's actually created, not only later
        // at sign time - approve()/sign() both need to validate an EXISTING PDF against a hash
        // that was captured when that exact file was produced, not compute it for the first time
        // during their own checks.
        protocol.setPdfSha256(sha256Hex(built.bytes()));
        contentVersionService.bump(protocol);
        // Stamp the version this PDF was actually rendered from AFTER the bump - the bump itself
        // marks "content version N+1 now has a materialized PDF snapshot"; any mutation from here
        // on nulls both pdfFileId and this field together via clearGeneratedDocuments.
        protocol.setPdfSourceContentVersion(protocol.getContentVersion());
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
        return buildPdf(protocolId).bytes();
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
        java.util.Map<Long, ProtocolSamplingPoint> points = new java.util.LinkedHashMap<>();
        samplingPointRepository.findByProtocolIdOrderBySortOrderAscIdAsc(protocol.getId())
                .forEach(point -> points.put(point.getId(), point));
        return ProtocolDocxTemplateRenderer.render(key, protocol, results, env, logoBytes, logoContentType, points);
    }

    private PdfBuildResult buildPdf(Long protocolId) throws IOException {
        Protocol protocol = getProtocol(protocolId);
        byte[] docx = buildDocx(protocol);
        try {
            return new PdfBuildResult(convertDocxToPdf(docx), false);
        } catch (IOException conversionFailure) {
            // Local/H2 development and CI do not necessarily have LibreOffice installed. Produce
            // a valid deterministic PDF instead of breaking preview/signing completely - but this
            // fallback document is NOT the real template output, so ProtocolService#sign refuses
            // to let anyone sign it (see Protocol#pdfIsFallback) unless explicitly allowed.
            log.warn("LibreOffice conversion unavailable, using built-in PDF renderer: {}",
                    conversionFailure.getMessage());
            return new PdfBuildResult(renderFallbackPdf(protocol), true);
        }
    }

    private byte[] renderFallbackPdf(Protocol protocol) throws IOException {
        try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            com.lowagie.text.Document document = new com.lowagie.text.Document();
            com.lowagie.text.pdf.PdfWriter.getInstance(document, out);
            document.open();
            document.add(new com.lowagie.text.Paragraph("EcoProgress laboratory protocol"));
            document.add(new com.lowagie.text.Paragraph("Protocol: " + protocol.getProtocolNumber()));
            document.add(new com.lowagie.text.Paragraph("Date: " + protocol.getProtocolDate()));
            document.add(new com.lowagie.text.Paragraph("Content version: " + protocol.getContentVersion()));
            document.close();
            return out.toByteArray();
        } catch (com.lowagie.text.DocumentException ex) {
            throw new IOException("Built-in PDF generation failed", ex);
        }
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

    private static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
