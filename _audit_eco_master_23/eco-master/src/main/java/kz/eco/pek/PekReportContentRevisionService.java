package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import org.springframework.stereotype.Component;

/**
 * The single place that bumps {@link PekReport#getContentRevision()} (module fix: previously
 * nothing did this at all - editing plan/fact rows, exceedances/evidence, protocol-source matches,
 * permits, or monitoring directions never touched the PekReport row itself, so the JPA
 * {@code version} silently failed to detect that a generated PDF/DOCX/package had gone stale).
 * Called from every service that mutates a report-affecting sub-resource, mirroring
 * kz.eco.protocol.ProtocolContentVersionService's role for protocols.
 */
@Component
public class PekReportContentRevisionService {

    private final PekReportRepository reportRepository;

    public PekReportContentRevisionService(PekReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    public void bump(PekReport report) {
        long next = (report.getContentRevision() == null ? 0L : report.getContentRevision()) + 1;
        report.setContentRevision(next);
        // saveAndFlush (not save): callers immediately serialize report.getVersion() into an API
        // response - without forcing the flush here, that JPA @Version increment (triggered by
        // this very update) wouldn't be visible in-memory yet, so the version handed back to the
        // client would already be stale by the time they use it as their next If-Match/version.
        reportRepository.saveAndFlush(report);
    }

    /** Convenience overload for callers that only have the reportId (e.g. a service that doesn't
     *  otherwise need to load the full PekReport). No-op if the report doesn't exist - callers
     *  that need existence to be guaranteed should load it themselves first. */
    public void bump(Long reportId) {
        reportRepository.findById(reportId).ifPresent(this::bump);
    }

    /** Shared staleness gate for every operation that must never act on a document rendered from
     *  an older revision of the report's data: download PDF/DOCX, approve, sign, package generate
     *  (compared against the report's contentRevision at package-generation time, checked again
     *  before download) and package download. A {@code null} sourceContentRevision (a document
     *  generated before this field existed) is treated as "unknown, assume current" rather than
     *  unconditionally stale, so already-generated documents aren't retroactively broken.
     *  @throws ConflictException("...", "PEK_DOCUMENT_STALE") on mismatch */
    public void requireCurrent(Long sourceContentRevision, PekReport report) {
        if (sourceContentRevision != null && !sourceContentRevision.equals(report.getContentRevision())) {
            throw new ConflictException(
                    "Документ устарел - данные отчёта изменились после его формирования, "
                            + "сформируйте документ заново", "PEK_DOCUMENT_STALE");
        }
    }
}
