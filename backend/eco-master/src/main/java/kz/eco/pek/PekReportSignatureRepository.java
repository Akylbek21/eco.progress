package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekReportSignatureRepository extends JpaRepository<PekReportSignature, Long> {
    List<PekReportSignature> findByReportIdOrderBySignedAtDesc(Long reportId);
    Optional<PekReportSignature> findTopByReportIdOrderBySignedAtDesc(Long reportId);
    Optional<PekReportSignature> findByCmsFileId(String cmsFileId);
}
