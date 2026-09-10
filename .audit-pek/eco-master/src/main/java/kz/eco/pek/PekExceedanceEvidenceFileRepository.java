package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekExceedanceEvidenceFileRepository extends JpaRepository<PekExceedanceEvidenceFile, Long> {

    List<PekExceedanceEvidenceFile> findByExceedanceIdOrderByUploadedAtDesc(Long exceedanceId);
}
