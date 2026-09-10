package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderDocumentRepository extends JpaRepository<OrderDocument, Long> {
    List<OrderDocument> findByOrderIdOrderByUploadedAtDesc(String orderId);

    /** Used by FileController to resolve which order (if any) owns a given fileId, by matching
     *  the exact "/api/files/documents/{fileId}" URL that was stored at upload time. */
    Optional<OrderDocument> findByFileUrl(String fileUrl);
}
