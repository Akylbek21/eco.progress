package kz.eco.pek;

import kz.ecoprogress.documentflow.signing.ForbiddenException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.storage.FileStorageService;
import kz.eco.user.User;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * Centralized ownership check for a client-supplied {@code fileId} before it is persisted as
 * exceedance evidence (module fix: attachEvidence previously saved whatever fileId the request
 * body contained, with zero verification that it was ever uploaded for this exceedance, let alone
 * by someone with access to it). A fileId is only accessible for a given exceedance if it was
 * uploaded through {@link PekExceedanceService#uploadEvidenceFile} for that exact exceedance -
 * that call stamps the file's storage contextId as {@code "pek-exceedance-" + exceedanceId}, so
 * this check is a simple, exact context-tag comparison rather than a fileId-parsing heuristic.
 */
@Service
public class PekEvidenceFileAccessService {

    private final FileStorageService fileStorageService;

    public PekEvidenceFileAccessService(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    static String contextFor(Long exceedanceId) {
        return "pek-exceedance-" + exceedanceId;
    }

    /** @throws NotFoundException("...", "PEK_EVIDENCE_FILE_NOT_FOUND") if the fileId doesn't exist
     *  @throws ForbiddenException("...", "PEK_EVIDENCE_FILE_SCOPE_MISMATCH") if it exists but was
     *  uploaded for a different exceedance/report/company (or wasn't uploaded through the PEK
     *  evidence upload endpoint at all, e.g. a fileId borrowed from an unrelated module) */
    public void requireAccessibleForExceedance(String fileId, Long exceedanceId, User actor) {
        FileStorageService.FileOwnership ownership;
        try {
            ownership = fileStorageService.loadOwnership(fileId);
        } catch (IOException | NotFoundException e) {
            throw new NotFoundException("Файл не найден: " + fileId, "PEK_EVIDENCE_FILE_NOT_FOUND");
        }
        String expectedContext = contextFor(exceedanceId);
        if (!expectedContext.equals(ownership.contextId())) {
            throw new ForbiddenException(
                    "Файл не относится к данному превышению", "PEK_EVIDENCE_FILE_SCOPE_MISMATCH");
        }
    }
}
