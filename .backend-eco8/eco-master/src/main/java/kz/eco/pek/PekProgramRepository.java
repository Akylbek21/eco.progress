package kz.eco.pek;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface PekProgramRepository extends JpaRepository<PekProgram, Long> {

    List<PekProgram> findByCompanyIdAndObjectIdOrderByValidFromDesc(Long companyId, Long objectId);

    Page<PekProgram> findByCompanyIdAndObjectId(Long companyId, Long objectId, Pageable pageable);

    List<PekProgram> findByCompanyIdAndObjectIdAndStatus(Long companyId, Long objectId, PekProgramStatus status);

    /** Backs GET /api/pek/dashboard's "deadlines" list (a program's validUntil is the only
     *  real, modeled deadline concept today - report-level dueDate tracking doesn't exist yet). */
    @Query("""
            select p from PekProgram p
            where p.status = kz.eco.pek.PekProgramStatus.ACTIVE
              and (:companyId is null or p.companyId = :companyId)
              and (:objectId is null or p.objectId = :objectId)
              and p.validUntil between :from and :to
            order by p.validUntil asc
            """)
    List<PekProgram> findActiveExpiringBetween(@Param("companyId") Long companyId, @Param("objectId") Long objectId,
                                                @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Backs the dashboard's programExecutionPercent proxy metric. */
    @Query("""
            select count(p) from PekProgram p
            where (:companyId is null or p.companyId = :companyId)
              and (:objectId is null or p.objectId = :objectId)
              and p.status <> kz.eco.pek.PekProgramStatus.ARCHIVED
            """)
    long countActivatableInScope(@Param("companyId") Long companyId, @Param("objectId") Long objectId);

    @Query("""
            select count(p) from PekProgram p
            where (:companyId is null or p.companyId = :companyId)
              and (:objectId is null or p.objectId = :objectId)
              and p.status = kz.eco.pek.PekProgramStatus.ACTIVE
            """)
    long countActiveInScope(@Param("companyId") Long companyId, @Param("objectId") Long objectId);

    /** GET /api/pek/programs (module spec §8): every filter is optional at the SQL level - the
     *  first list open with no companyId/objectId must not 400, and must not fall back to loading
     *  every program in the system into memory to filter in Java. search matches number/name
     *  (company/object/responsible are their own exact filters above, not fuzzy-searched, since
     *  this entity holds only their ids - see PekProgramService#list javadoc). */
    @Query("""
            select p from PekProgram p
            where (:companyId is null or p.companyId = :companyId)
              and (:objectId is null or p.objectId = :objectId)
              and (:status is null or p.status = :status)
              and (:responsibleUserId is null or p.responsibleUserId = :responsibleUserId)
              and (:activeOn is null or (p.validFrom <= :activeOn and p.validUntil >= :activeOn))
              and (:search is null
                   or lower(p.number) like :search
                   or lower(p.name) like :search)
            """)
    Page<PekProgram> search(@Param("companyId") Long companyId, @Param("objectId") Long objectId,
                             @Param("status") PekProgramStatus status,
                             @Param("responsibleUserId") Long responsibleUserId,
                             @Param("activeOn") LocalDate activeOn,
                             @Param("search") String search,
                             Pageable pageable);
}
