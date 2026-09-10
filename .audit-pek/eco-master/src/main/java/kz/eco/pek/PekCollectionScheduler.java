package kz.eco.pek;

import kz.eco.notification.NotificationService;
import kz.eco.pek.dto.PekApiDtos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Iteration 4: automated scheduler for PEK - drives {@link PekReportCollectionService#collect}
 * for reports whose company has {@code PekSettings.autoCollectProtocols} enabled, then checks
 * approaching due dates, still-open exceedances, overdue corrective actions and reports returned
 * for rework, sending an INTERNAL notification via the existing {@link NotificationService} for
 * each (deduplicated so a still-unresolved condition isn't renotified on every pass).
 *
 * <p>Timezone note: reports carry no per-company timezone field anywhere in the PEK module (only
 * periodStart/periodEnd as plain LocalDate) - this scheduler is therefore server-default/UTC-only,
 * a known limitation rather than an invented timezone field.
 *
 * <p>Concurrency guard is a plain DB-row lock ({@link PekSchedulerLockRepository#findForUpdate}),
 * not a distributed-lock library - none existed in pom.xml, and a single lock row is enough for
 * this job. {@link #STALE_LOCK_MINUTES} reclaims a lock left behind by a crashed run.
 */
@Component
public class PekCollectionScheduler {

    private static final Logger log = LoggerFactory.getLogger(PekCollectionScheduler.class);
    private static final long LOCK_ROW_ID = 1L;
    private static final long STALE_LOCK_MINUTES = 30;
    static final String JOB_NAME = "PEK_COLLECTION_AND_NOTIFICATIONS";

    /** Re-notify at most once per this many hours for the same still-unresolved (entity, type)
     *  condition - prevents every scheduler pass from re-spamming the same open exceedance. */
    private static final long RENOTIFY_AFTER_HOURS = 24;

    private final PekReportRepository reportRepository;
    private final PekAutoCollectionService autoCollectionService;
    private final PekSettingsService settingsService;
    private final PekSchedulerLockRepository lockRepository;
    private final PekSchedulerRunLogRepository runLogRepository;
    private final PekNotificationDedupRepository dedupRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final NotificationService notificationService;

    public PekCollectionScheduler(PekReportRepository reportRepository, PekAutoCollectionService autoCollectionService,
                                  PekSettingsService settingsService, PekSchedulerLockRepository lockRepository,
                                  PekSchedulerRunLogRepository runLogRepository, PekNotificationDedupRepository dedupRepository,
                                  PekReportExceedanceRepository exceedanceRepository, NotificationService notificationService) {
        this.reportRepository = reportRepository;
        this.autoCollectionService = autoCollectionService;
        this.settingsService = settingsService;
        this.lockRepository = lockRepository;
        this.runLogRepository = runLogRepository;
        this.dedupRepository = dedupRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${eco.pek.scheduler.interval-ms:3600000}")
    public void scheduledRun() {
        runIfNotLocked("SCHEDULED", null);
    }

    /** Module fix item 5: manual re-run scoped to exactly one company - the admin-gated
     *  POST /scheduler/run endpoint calls this when the caller supplies a companyId, and must
     *  never silently fall back to processing every company's reports. Use {@link #manualRunAll}
     *  for the deliberate global sweep instead. */
    public PekSchedulerRunLog manualRun(Long triggeringUserId, Long companyId) {
        if (companyId == null) {
            throw new kz.eco.common.exception.BadRequestException("Укажите companyId", "PEK_COMPANY_ID_REQUIRED");
        }
        return runIfNotLocked(triggeringUserId == null ? "MANUAL" : String.valueOf(triggeringUserId), companyId);
    }

    /** Module fix item 5: the deliberate, explicitly-named global sweep across every company -
     *  never triggered implicitly by omitting companyId from the scoped endpoint above. Gated to a
     *  narrower admin role at the controller (PEK_ADMIN), not any PEK_VIEW-eligible caller. */
    public PekSchedulerRunLog manualRunAll(Long triggeringUserId) {
        return runIfNotLocked(triggeringUserId == null ? "MANUAL_ALL" : String.valueOf(triggeringUserId), null);
    }

    private PekSchedulerRunLog runIfNotLocked(String triggeredBy, Long companyId) {
        if (!tryAcquireLock(triggeredBy)) {
            log.info("PEK scheduler run skipped - another run is already in progress");
            return null;
        }
        try {
            return doRun(triggeredBy, companyId);
        } finally {
            releaseLock();
        }
    }

    private boolean tryAcquireLock(String triggeredBy) {
        ensureLockRowExists();
        LocalDateTime now = LocalDateTime.now();
        int updated = lockRepository.tryAcquire(LOCK_ROW_ID, now, triggeredBy, now.minusMinutes(STALE_LOCK_MINUTES));
        return updated == 1;
    }

    /** V80 seeds the id=1 lock row for real deployments (Flyway-managed schemas), but the test
     *  profile builds its schema via {@code ddl-auto=create-drop} with Flyway disabled, so the row
     *  never gets seeded there - create it on first use instead of assuming it already exists. */
    private void ensureLockRowExists() {
        if (!lockRepository.existsById(LOCK_ROW_ID)) {
            PekSchedulerLock lock = new PekSchedulerLock();
            lock.setId(LOCK_ROW_ID);
            lock.setLocked(false);
            try {
                lockRepository.save(lock);
            } catch (Exception ignore) {
                // lost the race to create it - fine, the row exists now either way
            }
        }
    }

    private void releaseLock() {
        lockRepository.release(LOCK_ROW_ID);
    }

    private PekSchedulerRunLog doRun(String triggeredBy, Long companyId) {
        PekSchedulerRunLog runLog = startRunLog(triggeredBy);
        int processed = 0;
        int errors = 0;
        StringBuilder errorSummary = new StringBuilder();
        try {
            List<PekReportStatus> statuses = List.of(
                    PekReportStatus.DRAFT, PekReportStatus.COLLECTING,
                    PekReportStatus.READY_FOR_REVIEW, PekReportStatus.RETURNED);
            List<PekReport> candidates = companyId == null
                    ? reportRepository.findByStatusIn(statuses)
                    : reportRepository.findByCompanyIdAndStatusIn(companyId, statuses);
            Map<Long, PekSettings> settingsCache = new HashMap<>();
            for (PekReport report : candidates) {
                PekSettings settings = settingsCache.computeIfAbsent(report.getCompanyId(), settingsService::getEffectiveSettings);
                try {
                    processed += processReport(report, settings);
                } catch (Exception ex) {
                    errors++;
                    if (errorSummary.length() < 400) {
                        errorSummary.append("report ").append(report.getId()).append(": ")
                                .append(ex.getClass().getSimpleName()).append("; ");
                    }
                    log.warn("PEK scheduler failed processing report {}", report.getId(), ex);
                }
            }
        } catch (Exception ex) {
            errors++;
            errorSummary.append("run failed: ").append(ex.getClass().getSimpleName());
            log.error("PEK scheduler run failed", ex);
        }
        finishRunLog(runLog.getId(), processed, errors, errorSummary.isEmpty() ? null : errorSummary.toString());
        return runLogRepository.findById(runLog.getId()).orElse(runLog);
    }

    /** One report's worth of work: optional auto-collect, then the four notification checks.
     *  Returns 1 if this report was actually processed (collect attempted or at least one
     *  notification check ran), used only for the run log's processedCount. */
    @Transactional
    protected int processReport(PekReport report, PekSettings settings) {
        if (!settings.isNotifyMissingProtocols() && !settings.isNotifyExceedances()
                && !settings.isNotifyReportReturned() && !settings.isAutoCollectProtocols()) {
            return 0;
        }
        if (settings.isAutoCollectProtocols() && report.getStatus().isEditable()) {
            Long performedBy = report.getResponsibleUserId() != null
                    ? report.getResponsibleUserId() : report.getCreatedBy();
            PekApiDtos.CollectionResult result = autoCollectionService.autoCollect(report, performedBy);
            if (result != null && settings.isNotifyMissingProtocols() && result.linkedProtocolCount() == 0) {
                notifyOnce("PEK_REPORT", report.getId(), "MISSING_PROTOCOLS", "missing_protocols", report.getResponsibleUserId(),
                        "Не найдены протоколы для отчёта",
                        "Отчёт #" + report.getId() + " за период " + report.getPeriodKey()
                                + " - не найдено ни одного протокола для сбора данных.");
            }
        }
        checkApproachingDueDate(report, settings);
        checkReturnedForRework(report, settings);
        checkOpenExceedancesAndOverdueActions(report, settings);
        return 1;
    }

    private void checkApproachingDueDate(PekReport report, PekSettings settings) {
        if (report.getStatus() == PekReportStatus.ARCHIVED || report.getStatus() == PekReportStatus.SIGNED) return;
        int leadDays = settings.getNotifyBeforeDeadlineDays();
        LocalDate today = LocalDate.now();
        // Module fix: the regulatory submission deadline is report.submissionDueDate (computed at
        // creation per Правила №250 - 30/45 days after periodEnd), not periodEnd itself. periodEnd
        // only describes what was measured, not when the report is due - using it here notified
        // "approaching deadline" up to a month too early/late depending on report type.
        LocalDate dueDate = report.getSubmissionDueDate();
        if (dueDate == null) return;
        boolean approaching = !today.isAfter(dueDate) && !today.isBefore(dueDate.minusDays(leadDays));
        if (approaching) {
            notifyOnce("PEK_REPORT", report.getId(), "APPROACHING_DUE_DATE", "due_date_soon", report.getResponsibleUserId(),
                    "Приближается срок сдачи отчёта",
                    "Отчёт #" + report.getId() + " за период " + report.getPeriodKey()
                            + " должен быть готов к " + dueDate + ".");
        }
    }

    private void checkReturnedForRework(PekReport report, PekSettings settings) {
        if (!settings.isNotifyReportReturned()) return;
        if (report.getStatus() != PekReportStatus.RETURNED) return;
        notifyOnce("PEK_REPORT", report.getId(), "RETURNED_FOR_REWORK", "returned_rework", report.getResponsibleUserId(),
                "Отчёт возвращён на доработку",
                "Отчёт #" + report.getId() + " возвращён на доработку"
                        + (report.getReturnReason() != null ? ": " + report.getReturnReason() : "."));
    }

    private void checkOpenExceedancesAndOverdueActions(PekReport report, PekSettings settings) {
        if (!settings.isNotifyExceedances()) return;
        List<PekReportExceedance> exceedances = exceedanceRepository.findByReportId(report.getId());
        LocalDate today = LocalDate.now();
        for (PekReportExceedance exceedance : exceedances) {
            if (exceedance.getStatus() != null && exceedance.getStatus().isOpen()) {
                notifyOnce("PEK_EXCEEDANCE", exceedance.getId(), "OPEN_EXCEEDANCE", "open_exceedance",
                        exceedance.getResponsibleUserId() != null ? exceedance.getResponsibleUserId() : report.getResponsibleUserId(),
                        "Незакрытое превышение",
                        "Превышение #" + exceedance.getId() + " по отчёту #" + report.getId() + " остаётся открытым.");
                if (exceedance.getDueDate() != null && exceedance.getDueDate().isBefore(today)) {
                    notifyOnce("PEK_EXCEEDANCE", exceedance.getId(), "OVERDUE_CORRECTIVE_ACTION", "overdue_action",
                            exceedance.getResponsibleUserId() != null ? exceedance.getResponsibleUserId() : report.getResponsibleUserId(),
                            "Просрочено корректирующее действие",
                            "Корректирующее действие по превышению #" + exceedance.getId()
                                    + " просрочено (срок был " + exceedance.getDueDate() + ").");
                }
            }
        }
    }

    /** @param dedupType key used both for the dedup lookup and (lowercased) as the persisted
     *  Notification.type - kept short since that column is VARCHAR(20). */
    private void notifyOnce(String entityType, Long entityId, String dedupType, String notificationTypeCode,
                            Long userId, String title, String message) {
        if (!shouldNotify(entityType, entityId, dedupType)) return;
        if (userId == null) return; // no known recipient - nothing sane to notify (module has no
                                     // per-company "admins" broadcast role for PEK specifically)
        // Notification.orderId is VARCHAR(32) - just the entity id, not "type:id", to safely fit.
        notificationService.notify(userId, null, String.valueOf(entityId), title, message, notificationTypeCode);
    }

    @Transactional
    protected boolean shouldNotify(String entityType, Long entityId, String notifyType) {
        LocalDateTime now = LocalDateTime.now();
        PekNotificationDedup dedup = dedupRepository
                .findByEntityTypeAndEntityIdAndNotifyType(entityType, entityId, notifyType).orElse(null);
        if (dedup != null && dedup.getLastNotifiedAt().isAfter(now.minusHours(RENOTIFY_AFTER_HOURS))) {
            return false;
        }
        if (dedup == null) {
            dedup = new PekNotificationDedup();
            dedup.setEntityType(entityType);
            dedup.setEntityId(entityId);
            dedup.setNotifyType(notifyType);
        }
        dedup.setLastNotifiedAt(now);
        dedupRepository.save(dedup);
        return true;
    }

    @Transactional
    protected PekSchedulerRunLog startRunLog(String triggeredBy) {
        PekSchedulerRunLog runLog = new PekSchedulerRunLog();
        runLog.setJobName(JOB_NAME);
        runLog.setStatus(PekSchedulerRunStatus.RUNNING);
        runLog.setStartedAt(LocalDateTime.now());
        runLog.setTriggeredBy(triggeredBy);
        return runLogRepository.save(runLog);
    }

    @Transactional
    protected void finishRunLog(Long id, int processed, int errors, String errorSummary) {
        runLogRepository.findById(id).ifPresent(runLog -> {
            runLog.setFinishedAt(LocalDateTime.now());
            runLog.setProcessedCount(processed);
            runLog.setErrorCount(errors);
            runLog.setErrorSummary(errorSummary);
            runLog.setStatus(errors > 0 ? PekSchedulerRunStatus.FAILED : PekSchedulerRunStatus.SUCCESS);
            runLogRepository.save(runLog);
        });
    }
}
