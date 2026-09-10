package kz.eco.journal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * All filters are plain JPQL (not native SQL) on purpose: `data` is mapped as a String field (see
 * LabJournalEntry), so LOWER(e.data) LIKE ... works portably without any JSON-specific cast, and
 * Spring Data can auto-derive the count query for Page<> from JPQL - unlike native SQL, which
 * would need a hand-written countQuery and dialect-specific syntax (MySQL's CAST(x AS CHAR) /
 * <=> null-safe equals aren't valid on H2, used in tests).
 */
public interface LabJournalEntryRepository extends JpaRepository<LabJournalEntry, Long> {

    Optional<LabJournalEntry> findByIdAndDeletedFalse(Long id);

    /** Soft link back to the protocol (section 29): lets a protocol view list every journal row
     *  linked to it, e.g. "which results were used". */
    List<LabJournalEntry> findByProtocolId(Long protocolId);

    List<LabJournalEntry> findByProtocolIdAndDeletedFalse(Long protocolId);

    /** search matches the JSON data blob, the row number, or the creator's name (joined by id -
     *  LabJournalEntry has no JPA relation to User, so this is an EXISTS subquery rather than a
     *  join, keeping the rest of the query and its H2/MySQL portability untouched). */
    @Query("""
            SELECT e FROM LabJournalEntry e
            WHERE e.journalType = :journalType
              AND e.deleted = false
              AND (:laboratoryId IS NULL OR e.laboratoryId = :laboratoryId)
              AND (:dateFrom IS NULL OR e.entryDate >= :dateFrom)
              AND (:dateTo IS NULL OR e.entryDate <= :dateTo)
              AND (:search IS NULL
                   OR LOWER(e.data) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR CAST(e.rowNumber AS string) LIKE CONCAT('%', :search, '%')
                   OR EXISTS (SELECT 1 FROM User u WHERE u.id = e.createdBy
                              AND LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%'))))
            ORDER BY e.entryDate DESC, e.rowNumber DESC, e.id DESC
            """)
    Page<LabJournalEntry> search(@Param("journalType") String journalType,
                                  @Param("laboratoryId") Long laboratoryId,
                                  @Param("dateFrom") LocalDate dateFrom,
                                  @Param("dateTo") LocalDate dateTo,
                                  @Param("search") String search,
                                  Pageable pageable);

    /** Same filters as {@link #search}, unpaged, for the Excel export (needs every matching row). */
    @Query("""
            SELECT e FROM LabJournalEntry e
            WHERE e.journalType = :journalType
              AND e.deleted = false
              AND (:laboratoryId IS NULL OR e.laboratoryId = :laboratoryId)
              AND (:dateFrom IS NULL OR e.entryDate >= :dateFrom)
              AND (:dateTo IS NULL OR e.entryDate <= :dateTo)
              AND (:search IS NULL
                   OR LOWER(e.data) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR CAST(e.rowNumber AS string) LIKE CONCAT('%', :search, '%')
                   OR EXISTS (SELECT 1 FROM User u WHERE u.id = e.createdBy
                              AND LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%'))))
            ORDER BY e.entryDate DESC, e.rowNumber DESC, e.id DESC
            """)
    List<LabJournalEntry> searchAll(@Param("journalType") String journalType,
                                     @Param("laboratoryId") Long laboratoryId,
                                     @Param("dateFrom") LocalDate dateFrom,
                                     @Param("dateTo") LocalDate dateTo,
                                     @Param("search") String search);

    /**
     * All non-deleted entries for a journal+laboratory, most recent first. Used to seed
     * CHEMICAL_REAGENT_USAGE's running balance: the service filters this in Java by
     * data.substanceName + data.unit, because `data` is a plain JSON-text column and matching a
     * key inside it portably (MySQL in production, H2 in tests) is much simpler in Java than via
     * dialect-specific JSON functions (MySQL's JSON_EXTRACT has no H2 equivalent).
     */
    @Query("""
            SELECT e FROM LabJournalEntry e
            WHERE e.journalType = :journalType
              AND e.deleted = false
              AND ((:laboratoryId IS NULL AND e.laboratoryId IS NULL) OR e.laboratoryId = :laboratoryId)
            ORDER BY e.rowNumber DESC, e.id DESC
            """)
    List<LabJournalEntry> findAllForBalanceScope(@Param("journalType") String journalType,
                                                  @Param("laboratoryId") Long laboratoryId);
}
