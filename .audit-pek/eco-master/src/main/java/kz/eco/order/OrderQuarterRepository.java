package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderQuarterRepository extends JpaRepository<OrderQuarter, Long> {
    List<OrderQuarter> findByOrderIdOrderByQuarterAsc(String orderId);
    Optional<OrderQuarter> findByOrderIdAndQuarter(String orderId, int quarter);
}
