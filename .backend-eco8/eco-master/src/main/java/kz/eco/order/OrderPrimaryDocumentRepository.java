package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderPrimaryDocumentRepository extends JpaRepository<OrderPrimaryDocument, Long> {
    List<OrderPrimaryDocument> findByOrderId(String orderId);
    List<OrderPrimaryDocument> findByOrderIdAndDocumentGroup(String orderId, String group);

    /** Used by FileController to resolve which order (if any) owns a given fileId. */
    Optional<OrderPrimaryDocument> findByFileUrl(String fileUrl);
}
