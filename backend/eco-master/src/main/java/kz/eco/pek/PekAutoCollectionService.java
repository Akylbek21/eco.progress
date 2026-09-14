package kz.eco.pek;

import kz.eco.pek.dto.PekApiDtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The single application-level entry point for automatic protocol collection. {@link
 * PekCollectionScheduler} calls this - never {@link PekReportCollectionService#collect} directly -
 * so every trigger of an automatic collection gets the same guarantees on top of collect() itself
 * (which already does reconciliation + plan/fact + exceedance recompute via PekPlanFactService):
 *
 * <ul>
 *   <li>only ever touches a report that already exists and is DRAFT/COLLECTING/RETURNED - never
 *       creates a report;</li>
 *   <li>bumps {@code report.contentRevision} (via {@link PekReportContentRevisionService}, which
 *       also flushes and so advances the JPA {@code version}) only when the actual composition of
 *       {@code pek_report_protocol_sources} really changed - a re-run that finds nothing new must
 *       not inflate the revision counter that generated documents are staleness-checked against;</li>
 *   <li>records a {@link PekReportWorkflowHistory} row with {@code action=AUTO_COLLECT} - again
 *       only when something changed, so a no-op scheduler pass never produces a spurious audit
 *       entry.</li>
 * </ul>
 */
@Service
public class PekAutoCollectionService {

    private static final Logger log = LoggerFactory.getLogger(PekAutoCollectionService.class);

    /** Module spec: auto-collect only ever acts on an existing report in one of these statuses -
     *  identical to {@link PekReportStatus#isEditable()} today, but kept as an explicit local
     *  allowlist (rather than delegating to isEditable()) so a future, unrelated change to what
     *  "editable" means elsewhere in the workflow can't silently widen what auto-collect is allowed
     *  to touch. */
    private static final Set<PekReportStatus> AUTO_COLLECTIBLE =
            Set.of(PekReportStatus.DRAFT, PekReportStatus.COLLECTING, PekReportStatus.RETURNED);

    private final PekReportCollectionService collectionService;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekReportWorkflowHistoryRepository historyRepository;

    public PekAutoCollectionService(PekReportCollectionService collectionService,
                                     PekReportProtocolSourceRepository sourceRepository,
                                     PekReportContentRevisionService contentRevisionService,
                                     PekReportWorkflowHistoryRepository historyRepository) {
        this.collectionService = collectionService;
        this.sourceRepository = sourceRepository;
        this.contentRevisionService = contentRevisionService;
        this.historyRepository = historyRepository;
    }

    /** Canonical collect entry point for both manual and automatic collection. Runs the real
     *  reconciliation pass, then bumps contentRevision and records history only if the composition
     *  of sources actually changed — a no-op collect never inflates revision or creates audit.
     *  @param action "COLLECT" for manual, "AUTO_COLLECT" for scheduler
     *  @return null if the report's status isn't collectible */
    @Transactional
    public PekApiDtos.CollectionResult collectWithChangeDetection(PekReport report, Long performedBy, String action) {
        PekReportStatus statusBefore = report.getStatus();
        Long versionBefore = report.getVersion();
        String fingerprintBefore = fingerprint(report.getId());

        PekApiDtos.CollectionResult result = collectionService.collect(report);

        String fingerprintAfter = fingerprint(report.getId());
        boolean changed = !fingerprintBefore.equals(fingerprintAfter);
        if (changed) {
            contentRevisionService.bump(report);
            recordHistory(report, statusBefore, versionBefore, result, performedBy, action);
        }
        log.info("PEK collect: reportId={} action={} changed={} linkedProtocolCount={} contentRevision={}",
                report.getId(), action, changed, result.linkedProtocolCount(), report.getContentRevision());
        return result;
    }

    /** @return null if the report's status isn't one auto-collect may touch */
    @Transactional
    public PekApiDtos.CollectionResult autoCollect(PekReport report, Long performedBy) {
        if (!AUTO_COLLECTIBLE.contains(report.getStatus())) {
            return null;
        }
        return collectWithChangeDetection(report, performedBy, "AUTO_COLLECT");
    }

    /** A stable summary of exactly the part of report state that determines whether the composition
     *  of sources/results "really changed" - every source row's identity plus how it is currently
     *  matched/excluded. Deliberately excludes matchedAt/updatedAt/createdAt and the row's own JPA
     *  version: those can change on a save that doesn't alter any matching decision (e.g. the
     *  sourceVersion bookkeeping touch), which would otherwise make this fingerprint see a "change"
     *  on every single run and defeat the whole point of the check. */
    private String fingerprint(Long reportId) {
        return sourceRepository.findByReportId(reportId).stream()
                .sorted(Comparator.comparing(PekReportProtocolSource::getId))
                .map(s -> s.getId() + ":" + s.getProtocolId() + ":" + s.getProtocolResultId() + ":"
                        + s.getMatchStatus() + ":" + s.getProgramIndicatorId() + ":" + s.getControlItemId()
                        + ":" + s.isExcluded())
                .collect(Collectors.joining("|"));
    }

    private void recordHistory(PekReport report, PekReportStatus statusBefore, Long versionBefore,
                               PekApiDtos.CollectionResult result, Long performedBy, String action) {
        PekReportWorkflowHistory h = new PekReportWorkflowHistory();
        h.setReportId(report.getId());
        h.setFromStatus(statusBefore);
        h.setToStatus(report.getStatus());
        h.setAction(action);
        String prefix = "AUTO_COLLECT".equals(action) ? "Автоматический сбор" : "Сбор данных";
        h.setComment(prefix + ": протоколов " + result.linkedProtocolCount()
                + ", совпадений " + result.matchedCount() + ", без совпадения " + result.unmatchedCount()
                + ", неоднозначных " + result.ambiguousCount());
        h.setPerformedBy(performedBy);
        h.setVersionBefore(versionBefore);
        h.setVersionAfter(report.getVersion());
        historyRepository.save(h);
    }
}
