package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SigningAssignmentRepository extends JpaRepository<SigningAssignment, Long> {
    List<SigningAssignment> findAllByStepId(Long stepId);

    List<SigningAssignment> findAllByStepIdIn(List<Long> stepIds);

    Optional<SigningAssignment> findByInvitationTokenHash(String invitationTokenHash);
}
