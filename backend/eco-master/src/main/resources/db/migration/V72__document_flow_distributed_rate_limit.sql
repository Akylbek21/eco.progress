CREATE TABLE document_flow_public_rate_limits (
    key_hash VARCHAR(64) NOT NULL PRIMARY KEY,
    window_start TIMESTAMP NOT NULL,
    request_count INT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_df_public_rate_limit_window ON document_flow_public_rate_limits (window_start);
