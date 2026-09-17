-- PEK-native company membership table (Iteration 1 of the PEK module overhaul - tenant isolation).
-- Deliberately NOT a reuse of document_flow_memberships (different bounded context - see
-- PekCompanyMembership's javadoc). Starts EMPTY: no safe source of truth exists anywhere in the
-- current schema to backfill "which user belongs to which company for PEK purposes" from, so no
-- backfill INSERT is attempted here. ADMIN/DIRECTOR bypass membership checks entirely (global
-- access, see PekAccessService#hasGlobalAccess) and keep working immediately after this migration;
-- every other staff role needs a membership row seeded operationally (follow-up, not blocking).
CREATE TABLE pek_company_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(20) NOT NULL,
    status VARCHAR(16) NOT NULL,
    joined_at DATETIME NULL,
    invited_by BIGINT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_company_membership UNIQUE (company_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_company_memberships_company_id ON pek_company_memberships (company_id);
CREATE INDEX ix_pek_company_memberships_user_id ON pek_company_memberships (user_id);
