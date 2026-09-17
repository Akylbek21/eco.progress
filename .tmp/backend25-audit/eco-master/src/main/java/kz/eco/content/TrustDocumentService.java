package kz.eco.content;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.dto.CreateTrustDocumentRequest;
import kz.eco.content.dto.TrustDocumentDto;
import kz.eco.content.dto.TrustDocumentPublicDto;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Verification workflow for TrustDocument records (licenses/accreditations/certificates) - see
 *  TrustDocument#isPubliclyVisible(). Every mutation is version-checked (optimistic locking). */
@Service
public class TrustDocumentService {

    private final TrustDocumentRepository repository;

    public TrustDocumentService(TrustDocumentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TrustDocumentPublicDto> findAllVerified() {
        return repository.findAll().stream()
                .filter(TrustDocument::isPubliclyVisible)
                .map(TrustDocumentPublicDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TrustDocumentDto> findAllForAdmin() {
        return repository.findAll().stream().map(TrustDocumentDto::from).toList();
    }

    @Transactional
    public TrustDocumentDto create(CreateTrustDocumentRequest request) {
        TrustDocument d = new TrustDocument();
        d.setDocumentType(request.documentType());
        d.setDocumentNumber(request.documentNumber());
        d.setIssuedBy(request.issuedBy());
        d.setIssuedAt(request.issuedAt());
        d.setValidUntil(request.validUntil());
        d.setSourceUrl(request.sourceUrl());
        return TrustDocumentDto.from(repository.saveAndFlush(d));
    }

    @Transactional
    public TrustDocumentDto submitForVerification(Long id, Long version) {
        TrustDocument d = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(d.getVersion(), version);
        if (d.getVerificationStatus() != VerificationStatus.UNVERIFIED && d.getVerificationStatus() != VerificationStatus.REJECTED) {
            throw new ConflictException("Недопустимый переход статуса верификации", "TRUST_DOCUMENT_INVALID_TRANSITION");
        }
        d.setVerificationStatus(VerificationStatus.PENDING_VERIFICATION);
        return TrustDocumentDto.from(repository.saveAndFlush(d));
    }

    @Transactional
    public TrustDocumentDto verify(Long id, Long version, User actor) {
        TrustDocument d = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(d.getVersion(), version);
        if (d.getVerificationStatus() != VerificationStatus.PENDING_VERIFICATION) {
            throw new ConflictException("Документ не отправлен на верификацию", "TRUST_DOCUMENT_NOT_PENDING");
        }
        d.setVerificationStatus(VerificationStatus.VERIFIED);
        d.setVerifierId(actor.getId());
        d.setVerifiedAt(Instant.now());
        return TrustDocumentDto.from(repository.saveAndFlush(d));
    }

    @Transactional
    public TrustDocumentDto reject(Long id, Long version, User actor) {
        TrustDocument d = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(d.getVersion(), version);
        d.setVerificationStatus(VerificationStatus.REJECTED);
        return TrustDocumentDto.from(repository.saveAndFlush(d));
    }

    private TrustDocument getOrThrow(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Документ не найден: " + id));
    }
}
