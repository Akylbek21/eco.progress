-- organization_usage (current-period counters) + document_flow_access_requests (public/self-service
-- "contact us" leads). See kz.ecoprogress.documentflow.usage and .api packages.

CREATE TABLE IF NOT EXISTS organization_usage (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    documents_created BIGINT NOT NULL DEFAULT 0,
    signatures_created BIGINT NOT NULL DEFAULT 0,
    external_signatures_created BIGINT NOT NULL DEFAULT 0,
    storage_bytes BIGINT NOT NULL DEFAULT 0,
    active_members BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_usage_company FOREIGN KEY (organization_id) REFERENCES companies (id)
);

CREATE INDEX idx_org_usage_org_period ON organization_usage (organization_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS document_flow_access_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    contact_name VARCHAR(200) NOT NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(160) NULL,
    plan_code VARCHAR(40) NULL,
    members_count INT NULL,
    comment VARCHAR(2000) NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_df_access_requests_company FOREIGN KEY (organization_id) REFERENCES companies (id)
);

CREATE INDEX idx_df_access_requests_org ON document_flow_access_requests (organization_id);
CREATE INDEX idx_df_access_requests_status ON document_flow_access_requests (status);
