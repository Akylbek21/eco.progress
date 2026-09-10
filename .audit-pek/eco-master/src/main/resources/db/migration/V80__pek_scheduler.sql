-- PEK Iteration 4: automated scheduler infra (collection/reconciliation/due-date/exceedance/
-- overdue checks) + notification dedup bookkeeping. No new distributed-lock library was added
-- (pom.xml has none, e.g. no shedlock) - concurrency guard is a plain DB-row lock via
-- pek_scheduler_lock, taken with SELECT ... FOR UPDATE, matching the existing
-- PekReportRepository#findByIdForUpdate pattern already used by PekReportCollectionService.

-- One run per scheduler pass (manual or scheduled) - lets an admin see what happened without
-- reading server logs (module spec's "settings must really gate behavior" needs an audit trail
-- to prove it).
CREATE TABLE pek_scheduler_run_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    job_name VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    processed_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    error_summary VARCHAR(500) NULL,
    triggered_by VARCHAR(30) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_scheduler_run_logs_started_at ON pek_scheduler_run_logs (started_at);

-- Single-row mutex: a real DB row lock (SELECT ... FOR UPDATE), not an in-JVM synchronized, so it
-- also serializes across multiple app instances - the whole point of a lock table instead of just
-- relying on @Scheduled's default single-threaded executor. locked_at/locked_by let a stuck lock
-- (e.g. app instance crashed mid-run) be diagnosed; a TTL check in code, not a DB constraint,
-- reclaims a lock whose locked_at is older than the job's own timeout.
CREATE TABLE pek_scheduler_lock (
    id BIGINT NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at DATETIME NULL,
    locked_by VARCHAR(100) NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO pek_scheduler_lock (id, locked, locked_at, locked_by) VALUES (1, FALSE, NULL, NULL);

-- Notification dedup: one row per (entity_type, entity_id, notify_type) so a re-run of the
-- scheduler for a still-unresolved condition (open exceedance, still-missing protocols, etc.)
-- does not resend the same notification every pass - see PekCollectionScheduler#shouldNotify.
CREATE TABLE pek_notification_dedup (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    notify_type VARCHAR(40) NOT NULL,
    last_notified_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_notification_dedup UNIQUE (entity_type, entity_id, notify_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Scheduler's "reports needing attention" scan filters by status and orders/filters by
-- period_end (due-date proximity) - no existing index covers this access pattern (the dashboard
-- query filters on different columns and doesn't use an index either, see PekReportRepository).
CREATE INDEX ix_pek_reports_status_period_end ON pek_reports (status, period_end);
