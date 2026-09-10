package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, String>, JpaSpecificationExecutor<Order> {
    List<Order> findAllByOrderByCreatedAtDesc();
    List<Order> findByClientIdOrderByCreatedAtDesc(Long clientId);
    List<Order> findByCreatedByUserIdOrderByCreatedAtDesc(Long userId);
}
