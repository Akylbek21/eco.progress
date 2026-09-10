-- Password security hardening (Admin Users): admins no longer set a user's password directly -
-- the user sets it themselves via a one-time emailed link, so password_hash must be nullable
-- until that happens (status=pending_setup in the meantime).
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(200) NULL;

CREATE TABLE user_password_tokens (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    used_at DATETIME,
    CONSTRAINT uk_user_password_token UNIQUE (token_hash),
    CONSTRAINT fk_user_password_token_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_user_password_tokens_user ON user_password_tokens (user_id, purpose, status);
