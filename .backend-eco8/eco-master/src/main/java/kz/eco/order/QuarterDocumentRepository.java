package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface QuarterDocumentRepository extends JpaRepository<QuarterDocument, Long> {
    List<QuarterDocument> findByOrderQuarterIdOrderByCreatedAtDesc(Long orderQuarterId);

    /** Used by FileController to resolve which order (if any) owns a given fileId. */
    Optional<QuarterDocument> findByFileUrl(String fileUrl);
}
