package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.protocol.ProtocolStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * A real reconciliation pass, not a one-shot insert-only linker: links existing, already-finalized
 * Protocol rows for the report's companyId+objectId+period into the report (whole-protocol rows,
 * protocolResultId null) AND matches each linked protocol's individual ProtocolResult rows to a
 * specific PekProgramIndicator by normalized name+unit, creating a per-result row for EVERY actual
 * result - never skipped via {@code continue} (Task 4 fix). A result with zero or several candidate
 * indicators is recorded as {@link PekMatchStatus#UNMATCHED} / {@link PekMatchStatus#AMBIGUOUS}
 * respectively rather than silently dropped, so a human reviewing the report's sources can see and
 * resolve every real measurement instead of missing ones simply vanishing.
 *
 * <p>Links are rows in {@code pek_report_protocol_sources}, not a FK column on Protocol - a single
 * FK on Protocol can never let one protocol belong to a quarterly report AND a yearly report AND a
 * later corrective revision simultaneously, which the join table supports for free.
 *
 * <p>Re-running collect() is a real reconciliation, not merely idempotent-by-skipping: it removes
 * AUTO rows whose protocol/result is no longer part of the actual finalized set for this
 * company/object/period (protocol un-finalized, soft-deleted, or its date moved out of range -
 * Task 3), and re-derives AUTO rows for a protocol whose {@code @Version} has changed since it was
 * last matched (Task 4's "source_version" bookkeeping, finally compared instead of only recorded).
 * A human's MANUAL link is never auto-deleted even if its protocol/result later drops out of the
 * actual set - going stale is instead surfaced as a warning in the returned
 * {@link PekApiDtos.CollectionResult#warnings()} so a person, not this pass, decides what to do
 * about it (module spec: no automatic deletion of a manual decision).
 *
 * <p>Finishes by recomputing plan/fact and exceedances from the (possibly just-updated) set of
 * MATCHED rows, so collect() is the one operation that makes the report's numbers real again after
 * new protocols appear or old ones change.
 */
@Service
public class PekReportCollectionService {

    private static final Logger log = LoggerFactory.getLogger(PekReportCollectionService.class);

    /** Only a finalized protocol is real evidence of an actual monitoring result - a DRAFT or
     *  CALCULATED protocol is still being worked on and must not silently count (spec: "DRAFT-
     *  протокол не считается фактом"). */
    private static final Set<ProtocolStatus> FINALIZED_STATUSES =
            Set.of(ProtocolStatus.APPROVED, ProtocolStatus.SIGNED);

    private final ProtocolRepository protocolRepository;
    private final ProtocolResultRepository protocolResultRepository;
    private final PekProgramIndicatorRepository indicatorRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final PekReportRepository reportRepository;
    private final PekProgramRepository programRepository;
    private final PekProgramService programService;
    private final PekPlanFactService planFactService;
    private final PekSettingsService settingsService;
    private final PekProtocolEligibilityService eligibilityService;
    private final PekProgramControlItemRepository controlItemRepository;

    public PekReportCollectionService(ProtocolRepository protocolRepository,
                                       ProtocolResultRepository protocolResultRepository,
                                       PekProgramIndicatorRepository indicatorRepository,
                                       PekReportProtocolSourceRepository sourceRepository,
                                       PekReportRepository reportRepository,
                                       PekProgramRepository programRepository,
                                       PekProgramService programService,
                                       PekPlanFactService planFactService, PekSettingsService settingsService,
                                       PekProtocolEligibilityService eligibilityService,
                                       PekProgramControlItemRepository controlItemRepository) {
        this.protocolRepository = protocolRepository;
        this.protocolResultRepository = protocolResultRepository;
        this.indicatorRepository = indicatorRepository;
        this.sourceRepository = sourceRepository;
        this.reportRepository = reportRepository;
        this.programRepository = programRepository;
        this.programService = programService;
        this.planFactService = planFactService;
        this.settingsService = settingsService;
        this.eligibilityService = eligibilityService;
        this.controlItemRepository = controlItemRepository;
    }

    @Transactional
    public PekApiDtos.CollectionResult collect(PekReport reportArg) {
        long startNanos = System.nanoTime();

        // Real DB-level row lock (SELECT ... FOR UPDATE via PekReportRepository#findByIdForUpdate),
        // not an in-JVM synchronized - two concurrent collect() calls on the same report now
        // serialize instead of both reading the same "actual protocol set" and racing on
        // linkedProtocolCount/lastCollectedAt. Same persistence-context identity as reportArg
        // within this transaction (JPA's first-level cache), so this is not a second, divergent
        // copy of the entity.
        PekReport report = reportRepository.findByIdForUpdate(reportArg.getId())
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportArg.getId()));

        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Отчёт в статусе " + report.getStatus() + " нельзя пересобрать",
                    "PEK_REPORT_NOT_COLLECTIBLE");
        }

        PekProgram program = programRepository.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена: " + report.getProgramId()));
        // Defense in depth (Task 2): PekReportService already blocks creating a report whose period
        // isn't covered by its program, but the program's validFrom/validUntil can change after
        // creation - re-checked here so a later edit to the program can't silently make an existing
        // report's numbers based on protocols outside any program coverage window at all.
        if (!programService.coversPeriod(program, report.getPeriodStart(), report.getPeriodEnd())) {
            throw new BadRequestException("Программа ПЭК действует с " + program.getValidFrom() + " по "
                    + program.getValidUntil() + " и не покрывает период отчёта " + report.getPeriodStart()
                    + " - " + report.getPeriodEnd(), "PEK_PROGRAM_PERIOD_MISMATCH");
        }

        // 1. The actual, current finalized-protocol evidence set for this report's company/object/
        // period - re-derived fresh every call, exactly like before.
        List<Protocol> candidates = protocolRepository.findByCompanyIdAndObjectIdAndProtocolDateBetween(
                report.getCompanyId(), report.getObjectId(), report.getPeriodStart(), report.getPeriodEnd());
        PekSettings effectiveSettings = settingsService.getEffectiveSettings(report.getCompanyId());
        List<Protocol> actualProtocols = candidates.stream()
                .filter(p -> eligibilityService.evaluate(report, p, false).eligible())
                .toList();
        Map<Long, Protocol> actualProtocolsById = actualProtocols.stream()
                .collect(Collectors.toMap(Protocol::getId, p -> p));
        Set<Long> actualProtocolIds = actualProtocolsById.keySet();

        // Batch-load every result row for every actual protocol in one query (no N+1 across
        // protocols, on top of never querying per individual result).
        Map<Long, List<ProtocolResult>> resultsByProtocol = actualProtocolIds.isEmpty() ? Map.of()
                : protocolResultRepository.findByProtocolIdIn(actualProtocolIds).stream()
                        .collect(Collectors.groupingBy(ProtocolResult::getProtocolId));

        // Indicator-matching index, built once per program (not per result).
        List<PekProgramIndicator> programIndicators =
                indicatorRepository.findByProgramIdOrderBySortOrderAsc(report.getProgramId());
        Map<String, List<PekProgramIndicator>> indicatorsByName = programIndicators.stream()
                .collect(Collectors.groupingBy(i -> normalize(i.getIndicatorName())));
        Map<Long, PekProgramIndicator> indicatorsById = programIndicators.stream()
                .collect(Collectors.toMap(PekProgramIndicator::getId, i -> i));
        List<PekProgramControlItem> controlItems =
                controlItemRepository.findByProgramIdAndActiveTrue(report.getProgramId());
        Map<Long, PekProgramControlItem> controlItemsById = controlItems.stream()
                .collect(Collectors.toMap(PekProgramControlItem::getId, ci -> ci));
        Map<Long, List<PekProgramIndicator>> indicatorsByControlItem = programIndicators.stream()
                .collect(Collectors.groupingBy(PekProgramIndicator::getControlItemId));
        Map<Long, Long> monitoringPointToControlItem = controlItems.stream()
                .filter(ci -> ci.getMonitoringPointId() != null)
                .collect(Collectors.toMap(PekProgramControlItem::getMonitoringPointId, PekProgramControlItem::getId,
                        (a, b) -> a));

        // 2. Existing rows for this report, partitioned manual vs AUTO (module spec: a MANUAL row
        // is never touched by reconciliation deletion/rematch logic below).
        List<PekReportProtocolSource> existingSources = sourceRepository.findByReportId(report.getId());
        List<PekReportProtocolSource> manualSources = existingSources.stream()
                .filter(PekReportProtocolSource::isManual).toList();
        List<PekReportProtocolSource> autoSources = existingSources.stream()
                .filter(s -> !s.isManual()).toList();

        Set<Long> manualProtocolResultIds = manualSources.stream()
                .map(PekReportProtocolSource::getProtocolResultId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> manualWholeProtocolIds = manualSources.stream()
                .filter(s -> s.getProtocolResultId() == null)
                .map(PekReportProtocolSource::getProtocolId).collect(Collectors.toSet());

        // 3. Stale/changed AUTO rows: remove a row whose protocol dropped out of the actual set
        // (un-finalized, soft-deleted, moved out of period - Task 3), whose result no longer exists
        // on that protocol, or whose protocol's @Version differs from the version this row was
        // matched against (Task 4's source_version, finally compared, not just recorded).
        List<PekReportProtocolSource> toRemove = new ArrayList<>();
        int removedStaleSourceCount = 0;
        int updatedSourceCount = 0;
        for (PekReportProtocolSource s : autoSources) {
            Protocol actual = actualProtocolsById.get(s.getProtocolId());
            boolean protocolStillActual = actual != null;
            boolean resultStillActual = true;
            if (protocolStillActual && s.getProtocolResultId() != null) {
                resultStillActual = resultsByProtocol.getOrDefault(s.getProtocolId(), List.of()).stream()
                        .anyMatch(r -> r.getId().equals(s.getProtocolResultId()));
            }
            if (!protocolStillActual || !resultStillActual) {
                s.setMatchStatus(PekMatchStatus.STALE);
                s.setExcluded(true);
                s.setExclusionReason("Источник больше не соответствует условиям отчёта");
                s.setMatchReason(!protocolStillActual ? "Протокол больше не входит в выборку отчётного периода"
                        : "Результат протокола удалён");
                s.setUpdatedAt(LocalDateTime.now());
                sourceRepository.save(s);
                removedStaleSourceCount++;
                continue;
            }
            if (s.getMatchStatus() == PekMatchStatus.STALE) {
                toRemove.add(s);
                updatedSourceCount++;
                continue;
            }
            boolean versionChanged = s.getSourceVersion() != null && !s.getSourceVersion().equals(actual.getVersion());
            if (versionChanged) {
                toRemove.add(s);
                updatedSourceCount++;
            }
        }
        if (!toRemove.isEmpty()) {
            sourceRepository.deleteAll(toRemove);
            sourceRepository.flush();
        }
        Set<Long> removedIds = toRemove.stream().map(PekReportProtocolSource::getId).collect(Collectors.toSet());
        List<PekReportProtocolSource> remainingAuto = autoSources.stream()
                .filter(s -> !removedIds.contains(s.getId())).toList();
        Set<Long> autoWholeProtocolLinked = remainingAuto.stream()
                .filter(s -> s.getProtocolResultId() == null)
                .map(PekReportProtocolSource::getProtocolId).collect(Collectors.toSet());
        Set<Long> autoResultLinked = remainingAuto.stream()
                .map(PekReportProtocolSource::getProtocolResultId).filter(Objects::nonNull).collect(Collectors.toSet());

        // 4. Insert whatever's missing: a whole-protocol row per actual protocol not already linked
        // (AUTO or MANUAL), and a per-result row for every actual result not already covered by a
        // still-valid AUTO row or a MANUAL row (manual takes priority, never duplicated).
        LocalDateTime now = LocalDateTime.now();
        for (Long protocolId : actualProtocolIds) {
            Protocol protocol = actualProtocolsById.get(protocolId);
            if (!autoWholeProtocolLinked.contains(protocolId) && !manualWholeProtocolIds.contains(protocolId)) {
                PekReportProtocolSource whole = new PekReportProtocolSource();
                whole.setReportId(report.getId());
                whole.setProgramId(report.getProgramId());
                whole.setProtocolId(protocolId);
                whole.setMatchStatus(PekMatchStatus.MATCHED);
                whole.setMatchType("AUTO");
                whole.setSourceVersion(protocol.getVersion());
                whole.setMatchedAt(now);
                saveIgnoringRace(whole, report.getId(), protocolId, null);
            }

            for (ProtocolResult result : resultsByProtocol.getOrDefault(protocolId, List.of())) {
                if (manualProtocolResultIds.contains(result.getId()) || autoResultLinked.contains(result.getId())) {
                    continue;
                }
                IndicatorMatchResult match = matchIndicator(indicatorsByName, indicatorsById,
                        controlItemsById, indicatorsByControlItem, monitoringPointToControlItem,
                        result, protocol, effectiveSettings.isAllowFallbackMatching());
                PekReportProtocolSource resultSource = new PekReportProtocolSource();
                resultSource.setReportId(report.getId());
                resultSource.setProgramId(report.getProgramId());
                resultSource.setProtocolId(protocolId);
                resultSource.setProtocolResultId(result.getId());
                resultSource.setMatchStatus(match.status());
                resultSource.setMatchReason(match.reason());
                resultSource.setMatchType("AUTO");
                resultSource.setSourceVersion(protocol.getVersion());
                resultSource.setMatchedAt(now);
                if (match.status() == PekMatchStatus.MATCHED) {
                    resultSource.setControlItemId(match.controlItemId());
                    resultSource.setProgramIndicatorId(match.programIndicatorId());
                }
                saveIgnoringRace(resultSource, report.getId(), protocolId, result.getId());
            }
        }

        // 5. A MANUAL row whose protocol/result has dropped out of the actual set is never deleted
        // - surfaced as a warning instead (module spec: no automatic deletion of a manual decision).
        List<String> warnings = new ArrayList<>();
        for (PekReportProtocolSource s : manualSources) {
            boolean protocolStillActual = actualProtocolIds.contains(s.getProtocolId());
            boolean resultStillActual = s.getProtocolResultId() == null || (protocolStillActual
                    && resultsByProtocol.getOrDefault(s.getProtocolId(), List.of()).stream()
                            .anyMatch(r -> r.getId().equals(s.getProtocolResultId())));
            if (!protocolStillActual || !resultStillActual) {
                warnings.add("Ручная привязка (protocol #" + s.getProtocolId()
                        + (s.getProtocolResultId() != null ? ", result #" + s.getProtocolResultId() : "")
                        + ") больше не подтверждена автоматическим сбором - протокол мог потерять "
                        + "финальный статус, быть удалён или выйти за период отчёта. Проверьте вручную.");
            }
        }

        // 6. Recompute the real distinct-protocol count (Task 1 fix - countByReportIdAndExcludedFalse
        // counts ROWS, which double-counts a protocol with more than one result row).
        long linkedCount = sourceRepository.countDistinctProtocolsByReportId(report.getId());
        report.setLinkedProtocolCount((int) linkedCount);
        report.setLastCollectedAt(now);
        if (report.getStatus() == PekReportStatus.DRAFT) {
            report.setStatus(PekReportStatus.COLLECTING);
        }
        report.setUpdatedAt(now);

        planFactService.recompute(report);

        // Final tally over the report's current, real state (not just what this call touched) -
        // includes rows kept untouched from before, so a re-run without any actual changes still
        // reports accurate totals.
        List<PekReportProtocolSource> finalSources = sourceRepository.findByReportIdAndExcludedFalse(report.getId());
        List<PekReportProtocolSource> finalResultRows = finalSources.stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        int matchedCount = (int) finalResultRows.stream().filter(s -> s.getMatchStatus() == PekMatchStatus.MATCHED).count();
        int unmatchedCount = (int) finalResultRows.stream().filter(s -> s.getMatchStatus() == PekMatchStatus.UNMATCHED).count();
        int ambiguousCount = (int) finalResultRows.stream().filter(s -> s.getMatchStatus() == PekMatchStatus.AMBIGUOUS).count();

        List<String> numbers = actualProtocols.stream().map(Protocol::getProtocolNumber).toList();

        long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
        log.info("PEK collect: reportId={} companyId={} programId={} period=[{},{}] foundProtocolCount={} "
                        + "linkedProtocolCount={} protocolResultCount={} matchedCount={} unmatchedCount={} "
                        + "ambiguousCount={} removedStaleCount={} updatedCount={} warnings={} durationMs={}",
                report.getId(), report.getCompanyId(), report.getProgramId(), report.getPeriodStart(), report.getPeriodEnd(),
                actualProtocols.size(), linkedCount, finalResultRows.size(), matchedCount, unmatchedCount,
                ambiguousCount, removedStaleSourceCount, updatedSourceCount, warnings.size(), durationMs);

        return new PekApiDtos.CollectionResult(null, (int) linkedCount, numbers,
                finalResultRows.size(), matchedCount, unmatchedCount, ambiguousCount,
                removedStaleSourceCount, updatedSourceCount, warnings);
    }

    /** The exists()+save() upsert this project standardized on (module spec §5: "не использовать
     *  неатомарную схему exists()+save()" alone) - the real dedup guarantee is the DB-level unique
     *  index (V56's protocol_result_key), this catch just turns a lost race into a harmless no-op
     *  log line instead of a 500. */
    private void saveIgnoringRace(PekReportProtocolSource source, Long reportId, Long protocolId, Long protocolResultId) {
        try {
            sourceRepository.saveAndFlush(source);
        } catch (DataIntegrityViolationException ex) {
            log.debug("Concurrent collect() already linked report={} protocol={} result={}, skipping",
                    reportId, protocolId, protocolResultId);
        }
    }

    /** Structured outcome of matching one ProtocolResult against a program's indicators - MATCHED
     *  only when exactly one candidate exists by normalized name (+unit, when the result carries
     *  one); zero candidates is UNMATCHED, more than one is AMBIGUOUS. Never guesses (module spec:
     *  "не привязывать без анализа результатов") - both non-MATCHED outcomes still produce a real
     *  row (Task 4 fix), just with controlItemId/programIndicatorId left null. */
    private record IndicatorMatchResult(PekMatchStatus status, Long programIndicatorId, Long controlItemId,
                                         List<Long> candidateIndicatorIds, String reason) {
        static IndicatorMatchResult matched(PekProgramIndicator indicator) {
            return new IndicatorMatchResult(PekMatchStatus.MATCHED, indicator.getId(), indicator.getControlItemId(),
                    List.of(), null);
        }

        static IndicatorMatchResult unmatched(String reason) {
            return new IndicatorMatchResult(PekMatchStatus.UNMATCHED, null, null, List.of(), reason);
        }

        static IndicatorMatchResult ambiguous(List<Long> candidateIds, String reason) {
            return new IndicatorMatchResult(PekMatchStatus.AMBIGUOUS, null, null, candidateIds, reason);
        }
    }

    /** Matching priority, evaluated in order - first tier that yields a real answer wins.
     *  Tiers 1 and 2 always run. Tier 3 (name+unit fallback) only runs if allowFallbackMatching is true. */
    private static IndicatorMatchResult matchIndicator(Map<String, List<PekProgramIndicator>> indicatorsByName,
                                                         Map<Long, PekProgramIndicator> indicatorsById,
                                                         Map<Long, PekProgramControlItem> controlItemsById,
                                                         Map<Long, List<PekProgramIndicator>> indicatorsByControlItem,
                                                         Map<Long, Long> monitoringPointToControlItem,
                                                         ProtocolResult result, Protocol protocol,
                                                         boolean allowFallbackMatching) {
        IndicatorMatchResult explicitLink = matchByExplicitLink(result, protocol, indicatorsById, controlItemsById,
                indicatorsByControlItem, indicatorsByName);
        if (explicitLink != null) return explicitLink;
        IndicatorMatchResult byMonitoringPoint = matchByMonitoringPointAndIndicator(
                indicatorsByName, indicatorsByControlItem, monitoringPointToControlItem, result);
        if (byMonitoringPoint != null) return byMonitoringPoint;
        if (!allowFallbackMatching) {
            return IndicatorMatchResult.unmatched("Fallback matching отключён настройками компании");
        }
        return matchByNameAndUnit(indicatorsByName, result);
    }

    /** Tier 1: explicit links from Protocol (pekControlItemId) or ProtocolResult (samplingPointId
     *  mapped to a control item's monitoringPointId). If the protocol carries a pekControlItemId,
     *  try to match the result's indicator name within that control item's indicators. */
    private static IndicatorMatchResult matchByExplicitLink(ProtocolResult result, Protocol protocol,
                                                              Map<Long, PekProgramIndicator> indicatorsById,
                                                              Map<Long, PekProgramControlItem> controlItemsById,
                                                              Map<Long, List<PekProgramIndicator>> indicatorsByControlItem,
                                                              Map<String, List<PekProgramIndicator>> indicatorsByName) {
        Long controlItemId = protocol.getPekControlItemId();
        if (controlItemId == null) return null;
        PekProgramControlItem controlItem = controlItemsById.get(controlItemId);
        if (controlItem == null) return null;
        List<PekProgramIndicator> ciIndicators = indicatorsByControlItem.getOrDefault(controlItemId, List.of());
        if (ciIndicators.isEmpty()) return null;
        if (ciIndicators.size() == 1) {
            return IndicatorMatchResult.matched(ciIndicators.get(0));
        }
        String resultName = normalize(result.getIndicatorName());
        String resultUnit = normalize(result.getUnit());
        if (resultName.isEmpty()) return null;
        List<PekProgramIndicator> candidates = ciIndicators.stream()
                .filter(i -> normalize(i.getIndicatorName()).equals(resultName))
                .filter(i -> resultUnit.isEmpty() || normalize(i.getUnit()).equals(resultUnit))
                .toList();
        if (candidates.size() == 1) return IndicatorMatchResult.matched(candidates.get(0));
        if (candidates.size() > 1) {
            return IndicatorMatchResult.ambiguous(
                    candidates.stream().map(PekProgramIndicator::getId).toList(),
                    "Несколько показателей в явно указанном пункте контроля");
        }
        return null;
    }

    /** Tier 2: ProtocolResult.samplingPointId → PekProgramControlItem.monitoringPointId → indicators
     *  within that control item, narrowed by indicator name. */
    private static IndicatorMatchResult matchByMonitoringPointAndIndicator(
            Map<String, List<PekProgramIndicator>> indicatorsByName,
            Map<Long, List<PekProgramIndicator>> indicatorsByControlItem,
            Map<Long, Long> monitoringPointToControlItem,
            ProtocolResult result) {
        Long samplingPointId = result.getSamplingPointId();
        if (samplingPointId == null) return null;
        Long controlItemId = monitoringPointToControlItem.get(samplingPointId);
        if (controlItemId == null) return null;
        List<PekProgramIndicator> ciIndicators = indicatorsByControlItem.getOrDefault(controlItemId, List.of());
        if (ciIndicators.isEmpty()) return null;
        String resultName = normalize(result.getIndicatorName());
        String resultUnit = normalize(result.getUnit());
        if (resultName.isEmpty()) {
            if (ciIndicators.size() == 1) return IndicatorMatchResult.matched(ciIndicators.get(0));
            return null;
        }
        List<PekProgramIndicator> candidates = ciIndicators.stream()
                .filter(i -> normalize(i.getIndicatorName()).equals(resultName))
                .filter(i -> resultUnit.isEmpty() || normalize(i.getUnit()).equals(resultUnit))
                .toList();
        if (candidates.size() == 1) return IndicatorMatchResult.matched(candidates.get(0));
        if (candidates.size() > 1) {
            return IndicatorMatchResult.ambiguous(
                    candidates.stream().map(PekProgramIndicator::getId).toList(),
                    "Несколько показателей в точке мониторинга");
        }
        return null;
    }

    private static IndicatorMatchResult matchByNameAndUnit(Map<String, List<PekProgramIndicator>> indicatorsByName,
                                                             ProtocolResult result) {
        String resultName = normalize(result.getIndicatorName());
        String resultUnit = normalize(result.getUnit());
        if (resultName.isEmpty()) {
            return IndicatorMatchResult.unmatched("Результат не содержит названия показателя");
        }
        List<PekProgramIndicator> sameName = indicatorsByName.getOrDefault(resultName, List.of());
        List<PekProgramIndicator> candidates = sameName.stream()
                .filter(indicator -> resultUnit.isEmpty() || normalize(indicator.getUnit()).equals(resultUnit))
                .toList();
        if (candidates.isEmpty()) {
            return IndicatorMatchResult.unmatched(
                    "Нет показателя программы с названием \"" + result.getIndicatorName() + "\""
                            + (result.getUnit() != null ? " и единицей \"" + result.getUnit() + "\"" : ""));
        }
        if (candidates.size() > 1) {
            return IndicatorMatchResult.ambiguous(
                    candidates.stream().map(PekProgramIndicator::getId).toList(),
                    "Несколько показателей программы соответствуют названию/единице измерения результата");
        }
        return IndicatorMatchResult.matched(candidates.get(0));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
