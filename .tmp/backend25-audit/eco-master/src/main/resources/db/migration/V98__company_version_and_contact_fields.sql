-- P0 module fix (Компании item 8/11): optimistic locking was entirely absent on both tables -
-- two concurrent PATCHes silently last-write-wins clobbered each other. Also adds the FE-only
-- contact fields the backend never actually stored (item 11).
ALTER TABLE companies ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN short_name VARCHAR(100) NULL;
ALTER TABLE companies ADD COLUMN website VARCHAR(255) NULL;
ALTER TABLE companies ADD COLUMN contact_email VARCHAR(255) NULL;

ALTER TABLE company_objects ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
