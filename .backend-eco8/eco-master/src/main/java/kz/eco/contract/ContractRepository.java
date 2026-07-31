package kz.eco.contract;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ContractRepository extends JpaRepository<Contract, Long> {
    Optional<Contract> findByOrderId(String orderId);
    List<Contract> findByClientId(Long clientId);
    boolean existsByContractNumber(String contractNumber);
}
