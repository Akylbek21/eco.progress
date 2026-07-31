package kz.ecoprogress.documentflow.counterparty;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CounterpartyRepository extends JpaRepository<Counterparty, Long> {

    Optional<Counterparty> findByOwnerOrganizationIdAndNormalizedBin(Long ownerOrganizationId, String normalizedBin);

    Page<Counterparty> findByOwnerOrganizationId(Long ownerOrganizationId, Pageable pageable);

    Optional<Counterparty> findByIdAndOwnerOrganizationId(Long id, Long ownerOrganizationId);
}
