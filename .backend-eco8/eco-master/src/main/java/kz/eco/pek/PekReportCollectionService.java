package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * The one real collector this vertical slice implements: links existing, already-finalized
 * Protocol rows for the report's companyId+objectId+period into the report, instead of the full
 * module spec's multi-collector pipeline (permits/waste/measures/documents aren't modeled yet -
 * see the PR description for what's out of scope).
 *
 * <p>Links are rows in {@code pek_report_protocol_sources}, not a FK column on Protocol - a single
 * FK on Protocol can never let one protocol belong to a quarterly report AND a yearly report AND a
 * later corrective revision simultaneously, which the join table supports for free.
 *
 * <p>Idempotent by construction: re-running collect() re-derives the same candidate set from
 * Protocol (a DRAFT protocol created later, once finalized, gets picked up by the next collect()
 * call) and only INSERTs a link row when {@link PekReportProtocolSourceRepository
 * #existsByReportIdAndProtocolIdAndProtocolResultIdIsNull} says one doesn't already exist for that
 * (report, protocol) pair - it never deletes or blindly recreates rows, so rows a human has marked
 * manual=true or excluded=true (via a future manual-override endpoint, not built in this slice)
 * are left untouched.
 */
@Service
public class PekReportCollectionService {

    private static final Logger log = LoggerFactory.getLogger(PekReportCollectionService.class);

    /** Only a finalized protocol is real evidence of an actual monitoring result - a DRAFT or
     *  CALCULATED protocol is still being worked on and must not silently count (spec: "DRAFT-
     *  протокол не считается фактом"). READY is the legacy simplified-flow equivalent of
     *  APPROVED/SIGNED (see ProtocolStatus). */
    private static final Set<ProtocolStatus> FINALIZED_STATUSES =
            Set.of(ProtocolStatus.READY, ProtocolStatus.APPROVED, ProtocolStatus.SIGNED);

    private final ProtocolRepository protocolRepository;
    private final PekReportProtocolSourceRepository sourceRepository;

    public PekReportCollectionService(ProtocolRepository protocolRepository,
                                       PekReportProtocolSourceRepository sourceRepository) {
        this.protocolRepository = protocolRepository;
        this.sourceRepository = sourceRepository;
    }

    @Transactional
    public PekApiDtos.CollectionResult collect(PekReport report) {
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Отчёт в статусе " + report.getStatus() + " нельзя пересобрать",
                    "PEK_REPORT_NOT_COLLECTIBLE");
        }
        List<Protocol> candidates = protocolRepository.findByCompanyIdAndObjectIdAndProtocolDateBetween(
                report.getCompanyId(), report.getObjectId(), report.getPeriodStart(), report.getPeriodEnd());

        List<Protocol> linked = candidates.stream()
                .filter(p -> p.getDeletedAt() == null)
                .filter(p -> FINALIZED_STATUSES.contains(p.getStatus()))
                .toList();

        LocalDateTime now = LocalDateTime.now();
        for (Protocol protocol : linked) {
            // Upsert: only create the link if it doesn't already exist for this (report, protocol)
            // pair - re-running collect() must not duplicate rows, and must never touch rows a
            // human has separately marked manual/excluded (those keep their own protocolId link,
            // untouched here since this only ever INSERTs, never deletes/updates existing rows).
            // The exists() check below is a cheap first pass, not the real guarantee - two
            // concurrent collect() runs could both pass it before either commits, so the real
            // dedup is the DB-level unique index added in V56 (protocol_result_key collapses NULL
            // to 0), and the catch below turns a lost race into a harmless no-op instead of a 500
            // (module spec §5: "не использовать неатомарную схему exists()+save()").
            if (sourceRepository.existsByReportIdAndProtocolIdAndProtocolResultIdIsNull(report.getId(), protocol.getId())) {
                continue;
            }
            PekReportProtocolSource source = new PekReportProtocolSource();
            source.setReportId(report.getId());
            source.setProgramId(report.getProgramId());
            source.setProtocolId(protocol.getId());
            source.setMatchStatus(PekMatchStatus.MATCHED);
            source.setMatchType("AUTO");
            source.setSourceVersion(protocol.getVersion());
            source.setMatchedAt(now);
            try {
                sourceRepository.saveAndFlush(source);
            } catch (DataIntegrityViolationException ex) {
                log.debug("Concurrent collect() already linked report={} protocol={}, skipping", report.getId(), protocol.getId());
            }
        }

        long linkedCount = sourceRepository.countByReportIdAndExcludedFalse(report.getId());
        report.setLinkedProtocolCount((int) linkedCount);
        report.setLastCollectedAt(now);
        if (report.getStatus() == PekReportStatus.DRAFT) {
            report.setStatus(PekReportStatus.COLLECTING);
        }
        report.setUpdatedAt(now);

        List<String> numbers = linked.stream().map(Protocol::getProtocolNumber).toList();
        return new PekApiDtos.CollectionResult(null, linked.size(), numbers);
    }
}
