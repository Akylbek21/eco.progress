package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekReportDocumentVersionRepository extends JpaRepository<PekReportDocumentVersion, Long> {
    /**
     * DANGEROUS for any official-report decision: the newest row of ANY documentType wins, so an
     * INTERNAL analytical document generated after the OFFICIAL one would be picked for signing,
     * submission, packaging and readiness. Only use it for genuinely type-agnostic bookkeeping
     * (e.g. allocating the next shared version number). Everything that must act on the state
     * report must use {@link #findTopByReportIdAndDocumentTypeOrderByVersionDesc} with
     * {@link PekReportDocumentType#OFFICIAL}.
     */
    List<PekReportDocumentVersion> findByReportIdOrderByVersionDesc(Long reportId);
    Optional<PekReportDocumentVersion> findTopByReportIdOrderByVersionDesc(Long reportId);
    Optional<PekReportDocumentVersion> findByReportIdAndVersion(Long reportId, Integer version);

    /** Type-scoped listing - OFFICIAL and INTERNAL version histories are separate products and are
     *  never mixed in an API response. */
    List<PekReportDocumentVersion> findByReportIdAndDocumentTypeOrderByVersionDesc(
            Long reportId, PekReportDocumentType documentType);

    /** The newest version of ONE document type - the only correct lookup for "the current official
     *  report document" (signing, submit/accept, package, readiness, availableActions). */
    Optional<PekReportDocumentVersion> findTopByReportIdAndDocumentTypeOrderByVersionDesc(
            Long reportId, PekReportDocumentType documentType);

    boolean existsByReportIdAndDocumentType(Long reportId, PekReportDocumentType documentType);
}
