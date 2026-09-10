ALTER TABLE news ADD COLUMN review_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE news ADD COLUMN author_id BIGINT NULL;
ALTER TABLE news ADD COLUMN reviewer_id BIGINT NULL;
ALTER TABLE news ADD COLUMN reviewed_at TIMESTAMP NULL;
ALTER TABLE news ADD COLUMN created_at TIMESTAMP NULL;
ALTER TABLE news ADD COLUMN updated_at TIMESTAMP NULL;

-- Rows that already exist were already live on the public site before this workflow existed -
-- backfilling them to DRAFT would silently de-index every article already ranking in search.
-- Mark pre-existing rows PUBLISHED so they keep their current index,follow/sitemap behavior;
-- only NEW rows created after this migration default to DRAFT and must go through the review
-- workflow. Legacy rows have no real reviewer on file - that must be filled in by an actual
-- editorial review pass (see project follow-up), not fabricated here.
UPDATE news SET review_status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP, created_at = CURRENT_TIMESTAMP
WHERE review_status = 'DRAFT';
