package kz.eco.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    List<PaymentTransaction> findByContractIdOrderByCreatedAtDesc(Long contractId);
    List<PaymentTransaction> findByPaymentIdOrderByCreatedAtDesc(Long paymentId);
}
