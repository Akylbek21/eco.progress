package kz.eco.company;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CompanyObjectRepository extends JpaRepository<CompanyObject, Long> {
    List<CompanyObject> findByCompanyIdAndStatusOrderByNameAsc(Long companyId, String status);
    List<CompanyObject> findByCompanyIdOrderByNameAsc(Long companyId);

    /** Ownership-safe single lookup - an id from a different company never matches, so callers
     *  don't need a separate "does this object belong to this company" check afterward. */
    Optional<CompanyObject> findByIdAndCompanyId(Long id, Long companyId);

    Optional<CompanyObject> findFirstByCompanyIdAndPrimaryTrue(Long companyId);

    boolean existsByCompanyId(Long companyId);

    List<CompanyObject> findByCompanyIdAndArchivedAtIsNull(Long companyId);

    /** Single aggregate query for the whole page of companies, instead of one COUNT per row. */
    @Query("""
            select o.companyId as companyId, count(o) as total from CompanyObject o
            where o.companyId in :companyIds and o.status = 'ACTIVE'
            group by o.companyId
            """)
    List<CompanyObjectCount> countActiveByCompanyIdIn(@Param("companyIds") List<Long> companyIds);

    @Query("""
            select o.companyId as companyId, count(o) as total from CompanyObject o
            where o.companyId in :companyIds
            group by o.companyId
            """)
    List<CompanyObjectCount> countAllByCompanyIdIn(@Param("companyIds") List<Long> companyIds);

    @Query("""
            select o.companyId as companyId, count(o) as total from CompanyObject o
            where o.companyId in :companyIds and o.status = 'ARCHIVED'
            group by o.companyId
            """)
    List<CompanyObjectCount> countArchivedByCompanyIdIn(@Param("companyIds") List<Long> companyIds);

    interface CompanyObjectCount {
        Long getCompanyId();
        Long getTotal();
    }
}
