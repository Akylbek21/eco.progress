package kz.eco.company;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Company c where c.id = :id")
    Optional<Company> lockForUpdate(@Param("id") Long id);

    /**
     * Real server-side search + pagination: a single indexed/paged SQL query, never a full-table
     * load filtered in Java. Sort order comes entirely from {@code pageable} (validated against a
     * whitelist in the service before this is called) rather than a hardcoded ORDER BY, so callers
     * can sort by any allowed column.
     * {@code searchDigits} is the search term with everything but digits stripped, so a BIN search
     * matches regardless of spaces/separators the user typed; it's null when the search term has
     * no digits at all; {@code contactPerson} covers the requested "contact person" search field.
     */
    /** {@code companyIds} is the tenant-scoping filter (module: Companies tenant isolation) -
     *  null means "unrestricted" (global-access role, see CompanyAccessService#hasGlobalAccess);
     *  a non-null (possibly empty) collection restricts results to exactly those companyIds. */
    @Query("""
            select c from Company c
            where (:status is null or c.status = :status)
              and (:companyIds is null or c.id in :companyIds)
              and (
                :search is null
                or lower(c.name) like lower(concat('%', :search, '%'))
                or lower(coalesce(c.legalAddress, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(c.actualAddress, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(c.phone, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(c.email, '')) like lower(concat('%', :search, '%'))
                or lower(coalesce(c.responsiblePerson, '')) like lower(concat('%', :search, '%'))
                or (:searchDigits is not null and c.bin like concat('%', :searchDigits, '%'))
              )
            """)
    Page<Company> search(@Param("status") CompanyStatus status,
                         @Param("search") String search,
                         @Param("searchDigits") String searchDigits,
                         @Param("companyIds") List<Long> companyIds,
                         Pageable pageable);

    @Query("""
            select c from Company c
            where (:companyIds is null or c.id in :companyIds)
              and (
                lower(c.name) like lower(concat('%', :query, '%'))
                or lower(coalesce(c.objectName, '')) like lower(concat('%', :query, '%'))
                or c.bin like concat('%', :query, '%')
              )
            order by c.name asc
            """)
    List<Company> quickSearch(@Param("query") String query, @Param("companyIds") List<Long> companyIds, Pageable pageable);

    boolean existsByBin(String bin);

    boolean existsByBinAndIdNot(String bin, Long id);

    /** Used by kz.ecoprogress.documentflow.api.AccessRequestController to find-or-create the
     *  Company backing a self-service document-flow signup for a user with no BIN-matched company yet. */
    Optional<Company> findByBin(String bin);

    /** Used by OrganizationResolver to look up the document-flow internal-mode default
     *  organization by name when no explicit id is configured (dev/test - production is expected
     *  to set document-flow.default-organization-id explicitly). */
    Optional<Company> findByName(String name);

    /** Read-only PEK selector. archivedAt is checked independently from status to exclude
     * partially migrated/legacy archived rows as well. */
    @Query("""
            select c from Company c
            where c.status = kz.eco.company.CompanyStatus.ACTIVE
              and c.archivedAt is null
              and (:companyIds is null or c.id in :companyIds)
            order by c.name asc
            """)
    List<Company> findActiveForPekScope(@Param("companyIds") java.util.Collection<Long> companyIds);
}
