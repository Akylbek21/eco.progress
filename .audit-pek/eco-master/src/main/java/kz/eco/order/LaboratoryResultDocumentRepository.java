package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface LaboratoryResultDocumentRepository extends JpaRepository<LaboratoryResultDocument, Long> {
    List<LaboratoryResultDocument> findByOrderId(String orderId);

    /** Used by FileController to resolve which order (if any) owns a given fileId. */
    Optional<LaboratoryResultDocument> findByFileUrl(String fileUrl);
}
