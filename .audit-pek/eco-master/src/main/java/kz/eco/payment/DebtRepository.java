package kz.eco.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DebtRepository extends JpaRepository<Debt, Long> {
    List<Debt> findByOrderIdOrderByCreatedAtDesc(String orderId);
    List<Debt> findByStatusNotOrderByCreatedAtDesc(DebtStatus status);
    List<Debt> findByClientEmailIgnoreCaseAndStatusNotOrderByCreatedAtDesc(String email, DebtStatus status);
    Optional<Debt> findByContractIdAndContractQuarterIdAndStatusNot(Long contractId, Long cqId, DebtStatus status);
    List<Debt> findAllByOrderByCreatedAtDesc();
}
