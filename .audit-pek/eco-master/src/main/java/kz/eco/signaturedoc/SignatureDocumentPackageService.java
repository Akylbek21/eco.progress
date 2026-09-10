package kz.eco.signaturedoc;

import kz.eco.common.exception.ConflictException;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Builds the signed package ZIP (original file + detached .p7s + signature-info.json), streamed
 * directly to the response rather than buffered in memory, matching
 * kz.ecoprogress.documentflow.signing.SigningService's ZipOutputStream pattern.
 *
 * <p>No PDF verification report is generated: kz.eco.pek's and kz.eco.protocol's docgen packages
 * are both built around their own domain models (PEK reports / protocols) and would need
 * significant new work to adapt to an arbitrary uploaded file - out of scope for this "first
 * iteration" feature per the spec's own guidance to skip it rather than half-build one. This is a
 * documented gap, not an oversight.
 */
@Service
public class SignatureDocumentPackageService {

    private final SignatureDocumentRepository documentRepository;
    private final SignatureDocumentSignatureRepository signatureRepository;
    private final FileStorageService fileStorageService;
    private final SignatureDocumentAuditService auditService;
    private final SignatureDocumentService documentService;
    private final ObjectMapper objectMapper;

    public SignatureDocumentPackageService(SignatureDocumentRepository documentRepository,
                                            SignatureDocumentSignatureRepository signatureRepository,
                                            FileStorageService fileStorageService,
                                            SignatureDocumentAuditService auditService,
                                            SignatureDocumentService documentService,
                                            ObjectMapper objectMapper) {
        this.documentRepository = documentRepository;
        this.signatureRepository = signatureRepository;
        this.fileStorageService = fileStorageService;
        this.auditService = auditService;
        this.documentService = documentService;
        this.objectMapper = objectMapper;
    }

    public record PackageFile(String filename) {
    }

    /** Module fix item 11: resolves access/status/filename WITHOUT touching the ZIP stream - used
     *  by the controller to fail fast (normal JSON 403/404/409) before committing a streaming
     *  response, since a StreamingResponseBody can no longer change the HTTP status once it starts
     *  writing. */
    @Transactional(readOnly = true)
    public String resolvePackageFilename(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = requireSignedDocument(id, actor, adminExtendedAccess);
        return packageFilename(document);
    }

    @Transactional(readOnly = true)
    public PackageFile buildZip(Long id, User actor, boolean adminExtendedAccess, OutputStream out) {
        SignatureDocument document = requireSignedDocument(id, actor, adminExtendedAccess);
        List<SignatureDocumentSignature> signatures = signatureRepository.findByDocumentIdOrderByCreatedAtDesc(document.getId());
        SignatureDocumentSignature latest = signatures.isEmpty() ? null : signatures.get(0);

        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            StoredFileContent original = fileStorageService.load(document.getStorageFileId());
            try (var in = original.inputStream()) {
                zip.putNextEntry(new ZipEntry(document.getOriginalFileName()));
                in.transferTo(zip);
                zip.closeEntry();
            }
            if (latest != null && latest.getCmsStorageId() != null) {
                StoredFileContent cms = fileStorageService.load(latest.getCmsStorageId());
                try (var in = cms.inputStream()) {
                    zip.putNextEntry(new ZipEntry(document.getOriginalFileName() + ".p7s"));
                    in.transferTo(zip);
                    zip.closeEntry();
                }
            }
            zip.putNextEntry(new ZipEntry("signature-info.json"));
            zip.write(objectMapper.writeValueAsBytes(buildSignatureInfo(document, latest)));
            zip.closeEntry();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сформировать пакет", e);
        }

        auditService.record(document.getId(), "DOWNLOAD_ZIP", actor.getId(), null, null, null, true, null);
        return new PackageFile(packageFilename(document));
    }

    private SignatureDocument requireSignedDocument(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = documentService.getScoped(id, actor, adminExtendedAccess);
        if (document.getStatus() != SignatureDocumentStatus.SIGNED) {
            throw new ConflictException("Пакет доступен только для подписанного документа", "DOCUMENT_VERSION_CONFLICT");
        }
        return document;
    }

    private static String packageFilename(SignatureDocument document) {
        String safeTitle = document.getTitle().replaceAll("[^\\p{L}\\p{N}_-]+", "_");
        String date = document.getSignedAt() != null
                ? document.getSignedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                : java.time.LocalDate.now().toString();
        return safeTitle + "_signed_" + date + ".zip";
    }

    private Map<String, Object> buildSignatureInfo(SignatureDocument document, SignatureDocumentSignature signature) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("documentId", document.getId());
        info.put("version", document.getVersion());
        info.put("sha256", document.getSha256());
        info.put("signedAt", document.getSignedAt() == null ? null : document.getSignedAt().toString());
        if (signature != null) {
            info.put("certificateSubject", signature.getCertificateSubject());
            info.put("certificateIin", signature.getCertificateIin());
            info.put("certificateValidFrom", signature.getCertificateValidFrom() == null ? null : signature.getCertificateValidFrom().toString());
            info.put("certificateValidTo", signature.getCertificateValidTo() == null ? null : signature.getCertificateValidTo().toString());
            info.put("signatureAlgorithm", signature.getSignatureAlgorithm());
            info.put("verificationStatus", signature.getVerificationStatus().name());
        }
        // Module spec item 5: honest per-check status (kz.eco.signature.verification.
        // CertificateCheckStatus name) rather than a hardcoded boolean - NOT_CONFIGURED by default
        // since no trust store/CRL/OCSP endpoint is configured, never faked as "passed".
        info.put("chainStatus", signature == null ? null : signature.getChainStatus());
        info.put("crlStatus", signature == null ? null : signature.getCrlStatus());
        info.put("ocspStatus", signature == null ? null : signature.getOcspStatus());
        info.put("tsaStatus", signature == null ? null : signature.getTsaStatus());
        return info;
    }
}
