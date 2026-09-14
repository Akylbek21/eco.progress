-- "Документооборот" (document-flow) signing module, part 1: routes/steps/assignments.
--
-- FK columns document_id reference Agent B's real document table (their V43-V46 migrations,
-- not present in this worktree). No physical FK constraint is added here to avoid a migration
-- ordering dependency across worktrees - only an index. Add the physical FK constraint in a
-- follow-up migration once Agent B's table is merged and its exact name/column types are known
-- (TODO-RECONCILE).
--
-- This migration also creates a minimal placeholder table
-- (document_flow_documents_signing_placeholder / document_flow_document_versions_signing_placeholder)
-- standing in for Agent B's Document/DocumentVersion entities purely so this module's own code
-- compiles and its own tests can run against a real schema before the documents worktree is
-- merged - see kz.ecoprogress.documentflow.document.Document/DocumentVersion. DELETE both
-- placeholder tables (and re-point the FKs below at the real tables) at merge time.

CREATE TABLE IF NOT EXISTS document_flow_documents_signing_placeholder (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    status VARCHAR(40) NOT NULL,
    current_version_id BIGINT,
    signing_deadline TIMESTAMP NULL,
    title VARCHAR(500),
    created_at TIMESTAMP NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS document_flow_document_versions_signing_placeholder (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS document_flow_signing_routes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    route_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    activated_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    external_signing_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_document_flow_signing_routes_document ON document_flow_signing_routes (document_id);
CREATE INDEX idx_document_flow_signing_routes_document_status ON document_flow_signing_routes (document_id, status);

CREATE TABLE IF NOT EXISTS document_flow_signing_steps (
    id BIGINT NOT NULL AUTO_INCREMENT,
    route_id BIGINT NOT NULL,
    step_order INT NOT NULL,
    required_count INT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_document_flow_signing_steps_route FOREIGN KEY (route_id)
        REFERENCES document_flow_signing_routes (id)
);

CREATE INDEX idx_document_flow_signing_steps_route ON document_flow_signing_steps (route_id, step_order);

-- Never stores a raw IIN or a raw invitation token - only their SHA-256 hex digest
-- (signer_iin_hash / invitation_token_hash). See SigningAssignment javadoc.
CREATE TABLE IF NOT EXISTS document_flow_signing_assignments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    step_id BIGINT NOT NULL,
    signer_type VARCHAR(30) NOT NULL,
    user_id BIGINT NULL,
    signer_full_name VARCHAR(255),
    signer_iin_hash VARCHAR(64),
    organization_name VARCHAR(500),
    organization_bin VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(30),
    role_code VARCHAR(100),
    required BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL,
    available_at TIMESTAMP NULL,
    viewed_at TIMESTAMP NULL,
    signed_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    rejection_reason VARCHAR(2000),
    invitation_token_hash VARCHAR(64) NULL,
    invitation_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_document_flow_signing_assignments_step FOREIGN KEY (step_id)
        REFERENCES document_flow_signing_steps (id)
);

CREATE INDEX idx_document_flow_signing_assignments_step ON document_flow_signing_assignments (step_id);
CREATE INDEX idx_document_flow_signing_assignments_user ON document_flow_signing_assignments (user_id);
CREATE UNIQUE INDEX uk_document_flow_signing_assignments_token ON document_flow_signing_assignments (invitation_token_hash);
