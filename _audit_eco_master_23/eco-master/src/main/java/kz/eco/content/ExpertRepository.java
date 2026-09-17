package kz.eco.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExpertRepository extends JpaRepository<Expert, Long> {
    List<Expert> findAllByVerificationStatus(VerificationStatus status);
}
