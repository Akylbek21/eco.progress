package kz.eco.contract;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ContractQuarterRepository extends JpaRepository<ContractQuarter, Long> {
    List<ContractQuarter> findByContractIdOrderByQuarterAsc(Long contractId);
    Optional<ContractQuarter> findByContractIdAndQuarter(Long contractId, int quarter);
}
