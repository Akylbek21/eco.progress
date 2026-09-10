-- Tenant isolation for the Companies module (previously absent entirely - any COMPANY_ACCESS-
-- eligible role could read/mutate ANY companyId by guessing an id). Starts EMPTY: no safe source
-- of truth exists in the current schema to backfill "which user belongs to which company" from.
-- ADMIN/DIRECTOR bypass membership checks entirely (see CompanyAccessService#hasGlobalAccess) and
-- keep working immediately after this migration; every other staff role needs a membership row
-- seeded operationally.
CREATE TABLE company_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(20) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_company_membership UNIQUE (company_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_company_memberships_company_id ON company_memberships (company_id);
CREATE INDEX ix_company_memberships_user_id ON company_memberships (user_id);
