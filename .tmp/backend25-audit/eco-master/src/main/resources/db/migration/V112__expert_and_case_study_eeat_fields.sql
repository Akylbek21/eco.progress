-- Expert: add E-E-A-T fields for public CMS/schema.org Person node
ALTER TABLE content_experts
    ADD COLUMN IF NOT EXISTS specializations  VARCHAR(600),
    ADD COLUMN IF NOT EXISTS experience_years INTEGER,
    ADD COLUMN IF NOT EXISTS profile_url      VARCHAR(300);

-- CaseStudy: add industry/objectType classification and publishedAt for schema.org
ALTER TABLE content_case_studies
    ADD COLUMN IF NOT EXISTS industry     VARCHAR(200),
    ADD COLUMN IF NOT EXISTS object_type  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS published_at DATE;
