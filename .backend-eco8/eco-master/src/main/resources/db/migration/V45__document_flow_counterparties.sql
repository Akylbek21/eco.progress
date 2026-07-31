-- Document Flow module - counterparties (external or cross-tenant parties a document is
-- exchanged with) and their representatives. See kz.ecoprogress.documentflow.counterparty.

CREATE TABLE IF NOT EXISTS document_flow_counterparties (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_organization_id BIGINT NOT NULL,
    linked_organization_id BIGINT,
    bin VARCHAR(32) NOT NULL,
    normalized_bin VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    director_name VARCHAR(255),
    address VARCHAR(500),
    email VARCHAR(255),
    phone VARCHAR(64),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_dfcp_owner_bin UNIQUE (owner_organization_id, normalized_bin)
);

CREATE INDEX idx_dfcp_owner ON document_flow_counterparties (owner_organization_id);
CREATE INDEX idx_dfcp_status ON document_flow_counterparties (status);

CREATE TABLE IF NOT EXISTS document_flow_counterparty_representatives (
    id BIGINT NOT NULL AUTO_INCREMENT,
    counterparty_id BIGINT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(64),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_dfcr_counterparty FOREIGN KEY (counterparty_id) REFERENCES document_flow_counterparties (id)
);

CREATE INDEX idx_dfcr_counterparty ON document_flow_counterparty_representatives (counterparty_id);

ALTER TABLE document_flow_documents
    ADD CONSTRAINT fk_dfd_counterparty FOREIGN KEY (counterparty_id) REFERENCES document_flow_counterparties (id);
