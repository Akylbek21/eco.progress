package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderCommentRepository extends JpaRepository<OrderComment, Long> {
    List<OrderComment> findByOrderIdOrderByCreatedAtDesc(String orderId);
    List<OrderComment> findByOrderQuarterIdOrderByCreatedAtDesc(Long orderQuarterId);
}
