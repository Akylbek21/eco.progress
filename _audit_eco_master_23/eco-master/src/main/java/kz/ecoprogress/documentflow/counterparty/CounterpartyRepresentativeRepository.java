package kz.ecoprogress.documentflow.counterparty;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CounterpartyRepresentativeRepository extends JpaRepository<CounterpartyRepresentative, Long> {

    List<CounterpartyRepresentative> findByCounterpartyId(Long counterpartyId);
}
