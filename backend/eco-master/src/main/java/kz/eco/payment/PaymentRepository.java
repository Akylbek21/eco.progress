package kz.eco.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByOrderIdOrderByCreatedAtDesc(String orderId);
    List<Payment> findByClientEmailIgnoreCaseOrderByCreatedAtDesc(String email);
    List<Payment> findAllByOrderByCreatedAtDesc();
}
