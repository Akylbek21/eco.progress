package kz.eco.protocol;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProtocolRepository extends JpaRepository<Protocol, Long> {

    List<Protocol> findAllByOrderByCreatedAtDesc();

    List<Protocol> findAllByStatusNotOrderByCreatedAtDesc(ProtocolStatus excludedStatus);

    Optional<Protocol> findByProtocolNumber(String protocolNumber);

    List<Protocol> findByOrderId(String orderId);

    /** Used only for one-time counter seeding (ProtocolNumberCounterService) when a
     *  (prefix, year) counter row doesn't exist yet - e.g. legacy protocols created before the
     *  counter table existed. Not used on the hot create() path (that's the counter table's job),
     *  so returning every match and computing the true numeric max in Java (instead of relying on
     *  lexicographic ORDER BY, which breaks once sequences reach 5 digits) is fine here. */
    List<Protocol> findByProtocolNumberStartingWith(String prefix);

    /** Used by kz.eco.pek.PekReportCollectionService to find finalized protocols that count as
     *  actual monitoring results for a report's period - filtered further by status in Java since
     *  "finalized" (APPROVED/SIGNED) isn't a single simple predicate. */
    List<Protocol> findByCompanyIdAndObjectIdAndProtocolDateBetween(Long companyId, Long objectId, LocalDate start, LocalDate end);

    /** Used by FileController to resolve which protocol (if any) owns a given GridFS/disk fileId,
     *  so a bare-fileId download can be ACL-checked against the owning protocol instead of being
     *  served to anyone who merely guesses/knows the id. */
    Optional<Protocol> findByDocxFileId(String docxFileId);

    Optional<Protocol> findByPdfFileId(String pdfFileId);

    Optional<Protocol> findBySignatureFileId(String signatureFileId);

    Optional<Protocol> findByLaboratoryLogoFileId(String laboratoryLogoFileId);

    boolean existsByCompanyId(Long companyId);

    long countByCompanyId(Long companyId);

    @Query("select max(p.protocolDate) from Protocol p where p.companyId = :companyId")
    Optional<LocalDate> findLastProtocolDateByCompanyId(@Param("companyId") Long companyId);

    /**
     * Real server-side search + filter + pagination - a single indexed/paged SQL query, never a
     * full-table load filtered in Java. Text search runs against the snapshot columns already
     * stored on the protocol row (companyNameSnapshot/companyBinSnapshot/objectNameSnapshot/
     * executorName/protocolNumber), so no join to companies/company_objects/laboratory_employees
     * is needed. includeArchived=false (the default) excludes ARCHIVED regardless of what other
     * filters are set, unless status=ARCHIVED is explicitly requested.
     *
     * <p>A protocol soft-deleted via ProtocolService.delete() (deletedAt set, status not ARCHIVED
     * - as opposed to an archived protocol, which also has deletedAt set for historical
     * timestamping reasons) must never appear here, with or without includeArchived: deletion is
     * not the same axis as the archived-visibility toggle.
     */
    @Query("""
            select p from Protocol p
            where (:includeArchived = true or :status = kz.eco.protocol.ProtocolStatus.ARCHIVED
                   or p.status <> kz.eco.protocol.ProtocolStatus.ARCHIVED)
              and (p.deletedAt is null or p.status = kz.eco.protocol.ProtocolStatus.ARCHIVED)
              and (:status is null or p.status = :status)
              and (:templateCode is null or p.templateCode = :templateCode)
              and (:subtype is null or p.subtype = :subtype)
              and (:companyId is null or p.companyId = :companyId)
              and (:objectId is null or p.objectId = :objectId)
              and (:laboratoryId is null or p.laboratoryId = :laboratoryId)
              and (:executorId is null or p.executorId = :executorId)
              and (:compliance is null or p.complianceStatus = :compliance)
              and (:dateFrom is null or p.protocolDate >= :dateFrom)
              and (:dateTo is null or p.protocolDate <= :dateTo)
              and (:published is null
                   or (:published = true and p.publishedAt is not null)
                   or (:published = false and p.publishedAt is null))
              and (
                :search is null
                or lower(p.protocolNumber) like lower(concat('%', :search, '%')) escape '\\'
                or lower(coalesce(p.companyNameSnapshot, '')) like lower(concat('%', :search, '%')) escape '\\'
                or lower(coalesce(p.companyBinSnapshot, '')) like lower(concat('%', :search, '%')) escape '\\'
                or lower(coalesce(p.objectNameSnapshot, '')) like lower(concat('%', :search, '%')) escape '\\'
                or lower(coalesce(p.executorName, '')) like lower(concat('%', :search, '%')) escape '\\'
                or lower(coalesce(p.laboratoryName, '')) like lower(concat('%', :search, '%')) escape '\\'
              )
              and (
                :scopeGlobal = true
                or p.companyId in :scopeCompanyIds
                or p.laboratoryId in :scopeLaboratoryIds
                or (:scopeExecutorId is not null and p.executorId = :scopeExecutorId)
                or p.id in :scopeExtraProtocolIds
              )
            """)
    Page<Protocol> search(@Param("status") ProtocolStatus status,
                          @Param("templateCode") String templateCode,
                          @Param("subtype") String subtype,
                          @Param("companyId") Long companyId,
                          @Param("objectId") Long objectId,
                          @Param("laboratoryId") Long laboratoryId,
                          @Param("executorId") Long executorId,
                          @Param("compliance") String compliance,
                          @Param("dateFrom") LocalDate dateFrom,
                          @Param("dateTo") LocalDate dateTo,
                          @Param("published") Boolean published,
                          @Param("search") String search,
                          @Param("includeArchived") boolean includeArchived,
                          @Param("scopeGlobal") boolean scopeGlobal,
                          @Param("scopeCompanyIds") Collection<Long> scopeCompanyIds,
                          @Param("scopeLaboratoryIds") Collection<Long> scopeLaboratoryIds,
                          @Param("scopeExecutorId") Long scopeExecutorId,
                          @Param("scopeExtraProtocolIds") Collection<Long> scopeExtraProtocolIds,
                          Pageable pageable);
}
