package kz.eco.signaturedoc;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Thin write-only wrapper so every service records audit entries the same way.
 *  REQUIRES_NEW (module fix): a FAILURE entry is usually recorded right before the caller's
 *  own @Transactional method throws (a rejected signature, a validation failure, ...) - without
 *  its own transaction, that audit row would be rolled back along with everything else the
 *  caller did, silently erasing the one record of what actually went wrong. */
@Service
public class SignatureDocumentAuditService {

    private final SignatureDocumentAuditLogRepository repository;

    public SignatureDocumentAuditService(SignatureDocumentAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long documentId, String action, Long actorUserId, Long companyId,
                        String ipAddress, String userAgent, boolean success, String errorCode) {
        SignatureDocumentAuditLog log = new SignatureDocumentAuditLog();
        log.setDocumentId(documentId);
        log.setAction(action);
        log.setActorUserId(actorUserId);
        log.setCompanyId(companyId);
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        log.setResult(success ? "SUCCESS" : "FAILURE");
        log.setErrorCode(errorCode);
        repository.save(log);
    }
}
