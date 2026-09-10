package kz.ecoprogress.documentflow.counterparty;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CounterpartyRepository extends JpaRepository<Counterparty, Long> {

    Optional<Counterparty> findByOwnerOrganizationIdAndNormalizedBin(Long ownerOrganizationId, String normalizedBin);

    Page<Counterparty> findByOwnerOrganizationId(Long ownerOrganizationId, Pageable pageable);

    Optional<Counterparty> findByIdAndOwnerOrganizationId(Long id, Long ownerOrganizationId);

    /** Module spec §15: server-side, case-insensitive, tenant-scoped search by name or BIN.
     *  {@code nameQuery} is expected lowercased/whitespace-normalized; {@code binQuery} is
     *  expected stripped of formatting the same way {@link Counterparty#normalizeBin} normalizes
     *  on write (so "123 456-789012" matches a stored BIN the same as "123456789012") - see
     *  CounterpartyController#search for where that normalization happens. Cyrillic names compare
     *  case-insensitively via lower() same as any other text. */
    @Query("""
            select c from Counterparty c
            where c.ownerOrganizationId = :organizationId
              and (:status is null or c.status = :status)
              and (:nameQuery is null or :nameQuery = ''
                   or lower(c.name) like concat('%', :nameQuery, '%')
                   or c.normalizedBin like concat('%', :binQuery, '%'))
            """)
    Page<Counterparty> search(@Param("organizationId") Long organizationId,
                               @Param("nameQuery") String nameQuery,
                               @Param("binQuery") String binQuery,
                               @Param("status") CounterpartyStatus status,
                               Pageable pageable);
}
