package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SigningAssignmentRepository extends JpaRepository<SigningAssignment, Long> {
    List<SigningAssignment> findAllByStepId(Long stepId);

    List<SigningAssignment> findAllByStepIdIn(List<Long> stepIds);

    Optional<SigningAssignment> findByInvitationTokenHash(String invitationTokenHash);

    /** Batch projection for {@code DocumentListItemDto.signedCount/requiredCount/rejectedCount}
     *  (module spec §8) - one query for the whole page of documents, not one per row. Scoped to
     *  each document's most recent ACTIVE-or-COMPLETED route (a document can accumulate older
     *  CANCELLED/DRAFT routes across replace cycles - those must not contribute to the counters a
     *  user actually sees). */
    interface SigningCountsRow {
        Long getDocumentId();
        Long getSignedCount();
        Long getRequiredCount();
        Long getRejectedCount();
    }

    @Query(value = """
            SELECT r.document_id AS documentId,
                   SUM(CASE WHEN a.status = 'SIGNED' THEN 1 ELSE 0 END) AS signedCount,
                   SUM(CASE WHEN a.required = true THEN 1 ELSE 0 END) AS requiredCount,
                   SUM(CASE WHEN a.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedCount
            FROM document_flow_signing_assignments a
            JOIN document_flow_signing_steps s ON a.step_id = s.id
            JOIN document_flow_signing_routes r ON s.route_id = r.id
            WHERE r.id IN (
                SELECT MAX(r2.id) FROM document_flow_signing_routes r2
                WHERE r2.document_id IN (:documentIds) AND r2.status IN ('ACTIVE', 'COMPLETED')
                GROUP BY r2.document_id
            )
            GROUP BY r.document_id
            """, nativeQuery = true)
    List<SigningCountsRow> aggregateCountsByDocumentIds(@Param("documentIds") List<Long> documentIds);

    /** Document ids (within the given candidate set) where {@code userId} currently has a live,
     *  actionable assignment on the document's ACTIVE route (module spec §7/§8:
     *  {@code requiresMySignature}). */
    @Query(value = """
            SELECT DISTINCT r.document_id
            FROM document_flow_signing_assignments a
            JOIN document_flow_signing_steps s ON a.step_id = s.id
            JOIN document_flow_signing_routes r ON s.route_id = r.id
            WHERE r.document_id IN (:documentIds)
              AND r.status = 'ACTIVE'
              AND a.user_id = :userId
              AND a.status IN ('AVAILABLE', 'VIEWED')
            """, nativeQuery = true)
    List<Long> findDocumentIdsRequiringMySignature(@Param("documentIds") List<Long> documentIds, @Param("userId") Long userId);
}
