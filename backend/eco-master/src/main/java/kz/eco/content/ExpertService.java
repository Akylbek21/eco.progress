package kz.eco.content;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.dto.CreateExpertRequest;
import kz.eco.content.dto.ExpertDto;
import kz.eco.content.dto.ExpertPublicDto;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Verification workflow for Expert records - see Expert#isPubliclyVisible(). Every mutation is
 *  version-checked (optimistic locking, see ContentVersioning). */
@Service
public class ExpertService {

    private final ExpertRepository repository;

    public ExpertService(ExpertRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ExpertPublicDto> findAllVerified() {
        return repository.findAllByVerificationStatus(VerificationStatus.VERIFIED).stream()
                .map(ExpertPublicDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExpertPublicDto findPublicById(Long id) {
        Expert e = getOrThrow(id);
        if (!e.isPubliclyVisible()) {
            throw new kz.eco.common.exception.NotFoundException("Эксперт не найден: " + id);
        }
        return ExpertPublicDto.from(e);
    }

    @Transactional(readOnly = true)
    public List<ExpertDto> findAllForAdmin() {
        return repository.findAll().stream().map(ExpertDto::from).toList();
    }

    @Transactional
    public ExpertDto create(CreateExpertRequest request) {
        Expert e = new Expert();
        e.setFullName(request.fullName());
        e.setPosition(request.position());
        e.setSpecializations(request.specializations());
        e.setExperienceYears(request.experienceYears());
        e.setCredentials(request.credentials());
        e.setBio(request.bio());
        e.setPhotoUrl(request.photoUrl());
        e.setProfileUrl(request.profileUrl());
        return ExpertDto.from(repository.saveAndFlush(e));
    }

    @Transactional
    public ExpertDto submitForVerification(Long id, Long version) {
        Expert e = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(e.getVersion(), version);
        if (e.getVerificationStatus() != VerificationStatus.UNVERIFIED && e.getVerificationStatus() != VerificationStatus.REJECTED) {
            throw new ConflictException("Недопустимый переход статуса верификации", "EXPERT_INVALID_TRANSITION");
        }
        e.setVerificationStatus(VerificationStatus.PENDING_VERIFICATION);
        return ExpertDto.from(repository.saveAndFlush(e));
    }

    @Transactional
    public ExpertDto verify(Long id, Long version, User actor) {
        Expert e = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(e.getVersion(), version);
        if (e.getVerificationStatus() != VerificationStatus.PENDING_VERIFICATION) {
            throw new ConflictException("Эксперт не отправлен на верификацию", "EXPERT_NOT_PENDING");
        }
        e.setVerificationStatus(VerificationStatus.VERIFIED);
        e.setVerifierId(actor.getId());
        e.setVerifiedAt(Instant.now());
        return ExpertDto.from(repository.saveAndFlush(e));
    }

    @Transactional
    public ExpertDto reject(Long id, Long version, User actor) {
        Expert e = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(e.getVersion(), version);
        e.setVerificationStatus(VerificationStatus.REJECTED);
        return ExpertDto.from(repository.saveAndFlush(e));
    }

    private Expert getOrThrow(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Эксперт не найден: " + id));
    }
}
