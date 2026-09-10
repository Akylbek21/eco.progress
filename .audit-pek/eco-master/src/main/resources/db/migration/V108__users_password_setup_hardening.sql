-- Fix for POST /api/admin/users returning 500 (correlation ID 8c34f3d6).
--
-- Root cause: kz.eco.user.User.passwordHash and kz.eco.user.UserStatus.pending_setup are both
-- legitimate at the JPA/entity level (see AdminUserService#createUser), and V89 already relaxed
-- users.password_hash to NULL and created user_password_tokens - but neither `users` nor
-- `email_outbox` is Flyway-managed at all (no migration ever contains CREATE TABLE for either;
-- both exist only because Hibernate's ddl-auto=update created them at some point in the past,
-- possibly before password_hash's @Column(nullable=false) annotation was ever removed from the
-- entity). If a given environment's `users` table was physically created back when that column
-- was still NOT NULL, and V89 did not actually apply against that same database (schema-history
-- gap, out-of-band DB provisioning, etc.), password_hash stays physically NOT NULL regardless of
-- what the entity/migration source says today - and userRepository.save(user) with
-- passwordHash=null (AdminUserService.java) then fails with a DataIntegrityViolationException /
-- SQLIntegrityConstraintViolationException, surfacing to the client as a bare 500.
--
-- This migration does NOT touch V89 (per instruction) - it independently, idempotently
-- re-asserts the same end state V89 already describes, so it fixes the issue regardless of
-- whether V89 actually ran on the affected database. Every statement is safe to run even if the
-- target state already holds, and none of them drop or truncate data.

-- Re-assert users.password_hash is nullable - a no-op if V89 already applied here, a real fix if
-- it didn't (e.g. this column was still physically NOT NULL from before password-setup-by-email
-- was introduced).
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(200) NULL;

-- users.status is EnumType.STRING -> plain VARCHAR(20), never a MySQL native ENUM(...) type, so
-- kz.eco.user.UserStatus.pending_setup (13 chars) already fits with no schema change needed and
-- no migration has ever added a CHECK constraint restricting allowed values. Re-assert the exact
-- shape defensively in case any environment has a narrower column than the entity expects.
ALTER TABLE users MODIFY COLUMN status VARCHAR(20) NOT NULL;

-- Restore user_password_tokens if it is missing in this environment (e.g. V89 didn't apply here
-- either, or the table was manually dropped) - identical definition to V89's, so this is a no-op
-- wherever the table already exists and preserves any rows already in it.
CREATE TABLE IF NOT EXISTS user_password_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    used_at DATETIME,
    CONSTRAINT uk_user_password_token_v108 UNIQUE (token_hash),
    CONSTRAINT fk_user_password_token_user_v108 FOREIGN KEY (user_id) REFERENCES users(id),
    KEY ix_user_password_tokens_user_v108 (user_id, purpose, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add index on existing table if it was created by V89 without the _v108 index.
-- MySQL 8.4 does not support CREATE INDEX IF NOT EXISTS, so use dynamic SQL with
-- information_schema check.
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'user_password_tokens'
    AND index_name = 'ix_user_password_tokens_user_v108');
SET @sql = IF(@idx_exists = 0
    AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'user_password_tokens') > 0,
    'CREATE INDEX ix_user_password_tokens_user_v108 ON user_password_tokens (user_id, purpose, status)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- email_outbox is also not Flyway-managed anywhere (Hibernate ddl-auto=update only) - restore it
-- too if missing, matching kz.eco.mail.EmailOutbox's exact column shape.
CREATE TABLE IF NOT EXISTS email_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(200) NOT NULL,
    subject VARCHAR(300) NOT NULL,
    body VARCHAR(4000) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    order_id VARCHAR(32),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_error VARCHAR(1000),
    created_at DATETIME NOT NULL,
    sent_at DATETIME,
    KEY idx_email_outbox_status (status),
    KEY idx_email_outbox_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add indexes on existing email_outbox if they're missing.
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'email_outbox'
    AND index_name = 'idx_email_outbox_status');
SET @sql = IF(@idx_exists = 0
    AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'email_outbox') > 0,
    'CREATE INDEX idx_email_outbox_status ON email_outbox (status)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'email_outbox'
    AND index_name = 'idx_email_outbox_created');
SET @sql = IF(@idx_exists = 0
    AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'email_outbox') > 0,
    'CREATE INDEX idx_email_outbox_created ON email_outbox (created_at)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
