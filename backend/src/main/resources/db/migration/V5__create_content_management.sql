-- Content Management schema. User/lead identifiers intentionally have no foreign keys:
-- the corresponding backend domain tables are not part of this repository snapshot.
CREATE TABLE content_categories (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id BIGINT REFERENCES content_categories(id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_items (
    id BIGSERIAL PRIMARY KEY,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN (
        'SERVICE', 'ARTICLE', 'REGION', 'REGIONAL_PAGE', 'CASE', 'EXPERT',
        'TRUST_DOCUMENT', 'LEGAL_SOURCE', 'REDIRECT'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'CONTENT_REVIEW', 'EXPERT_REVIEW', 'LEGAL_REVIEW', 'SEO_REVIEW',
        'READY_TO_PUBLISH', 'SCHEDULED', 'PUBLISHED', 'OUTDATED', 'UNPUBLISHED',
        'ARCHIVED', 'REJECTED'
    )),
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru', 'kk')),
    category_id BIGINT REFERENCES content_categories(id) ON DELETE RESTRICT,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
    seo JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(seo) = 'object'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    index_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    published_version_id BIGINT,
    draft_version_id BIGINT,
    optimistic_lock_version BIGINT NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    created_by VARCHAR(100) NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_type, slug, locale),
    CHECK (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL),
    CHECK (status <> 'PUBLISHED' OR published_version_id IS NOT NULL)
);

CREATE TABLE content_versions (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    version_status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (version_status IN ('draft', 'approved', 'published', 'archived')),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    seo JSONB NOT NULL CHECK (jsonb_typeof(seo) = 'object'),
    source_version_id BIGINT REFERENCES content_versions(id) ON DELETE SET NULL,
    change_summary TEXT,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_id, version_number)
);

ALTER TABLE content_items
    ADD CONSTRAINT fk_content_published_version FOREIGN KEY (published_version_id) REFERENCES content_versions(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_content_draft_version FOREIGN KEY (draft_version_id) REFERENCES content_versions(id) ON DELETE RESTRICT;

CREATE TABLE content_status_history (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version_id BIGINT REFERENCES content_versions(id) ON DELETE SET NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    comment TEXT,
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_comments (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version_id BIGINT NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
    field_path VARCHAR(500),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    author_id VARCHAR(100) NOT NULL,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((resolved_at IS NULL AND resolved_by IS NULL) OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);

CREATE TABLE content_legal_sources (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    document_number VARCHAR(255),
    source_url TEXT NOT NULL,
    official_source BOOLEAN NOT NULL DEFAULT FALSE,
    issued_at DATE,
    effective_from DATE,
    effective_to DATE,
    last_verified_at TIMESTAMPTZ,
    verified_by VARCHAR(100),
    status VARCHAR(16) NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'outdated', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE TABLE content_item_legal_sources (
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    legal_source_id BIGINT NOT NULL REFERENCES content_legal_sources(id) ON DELETE RESTRICT,
    note TEXT,
    PRIMARY KEY (content_id, legal_source_id)
);

CREATE TABLE content_regions (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
    city VARCHAR(255) NOT NULL,
    region_nominative VARCHAR(500) NOT NULL,
    region_genitive VARCHAR(500) NOT NULL,
    region_prepositional VARCHAR(500) NOT NULL,
    city_genitive VARCHAR(255),
    city_prepositional VARCHAR(255),
    remote_available BOOLEAN NOT NULL DEFAULT FALSE,
    onsite_available BOOLEAN NOT NULL DEFAULT FALSE,
    visit_terms TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE content_trust_documents (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL,
    registration_number VARCHAR(255),
    issued_at DATE,
    expires_at DATE,
    issuer VARCHAR(500),
    verification_url TEXT,
    document_status VARCHAR(32) NOT NULL DEFAULT 'REQUIRES_VERIFICATION' CHECK (document_status IN ('VALID', 'EXPIRING', 'EXPIRED', 'REQUIRES_VERIFICATION')),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at)
);

CREATE TABLE content_redirects (
    id BIGSERIAL PRIMARY KEY,
    source_path VARCHAR(1000) NOT NULL UNIQUE,
    target_path VARCHAR(1000) NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (source_path LIKE '/%'),
    CHECK (target_path LIKE '/%' OR target_path LIKE 'https://%'),
    CHECK (source_path <> target_path)
);

CREATE TABLE content_files (
    id BIGSERIAL PRIMARY KEY,
    storage_key VARCHAR(1000) NOT NULL UNIQUE,
    original_name VARCHAR(500) NOT NULL,
    media_type VARCHAR(255) NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    sha256 CHAR(64) NOT NULL,
    alt_text VARCHAR(500),
    uploaded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_item_files (
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    file_id BIGINT NOT NULL REFERENCES content_files(id) ON DELETE RESTRICT,
    usage_type VARCHAR(32) NOT NULL CHECK (usage_type IN ('hero', 'gallery', 'attachment', 'open_graph', 'author')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (content_id, file_id, usage_type)
);

CREATE TABLE content_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    request_id VARCHAR(100),
    ip_hash CHAR(64),
    user_agent_hash CHAR(64),
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_experiments (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    winning_variant_id BIGINT,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE content_experiment_variants (
    id BIGSERIAL PRIMARY KEY,
    experiment_id BIGINT NOT NULL REFERENCES content_experiments(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    weight INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),
    payload_patch JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload_patch) = 'object'),
    UNIQUE (experiment_id, code)
);

ALTER TABLE content_experiments
    ADD CONSTRAINT fk_content_experiment_winner FOREIGN KEY (winning_variant_id) REFERENCES content_experiment_variants(id) ON DELETE SET NULL;

CREATE TABLE content_review_policies (
    id BIGSERIAL PRIMARY KEY,
    content_type VARCHAR(32) NOT NULL UNIQUE,
    review_interval_days INTEGER NOT NULL CHECK (review_interval_days > 0),
    require_expert_review BOOLEAN NOT NULL DEFAULT TRUE,
    require_legal_review BOOLEAN NOT NULL DEFAULT FALSE,
    require_seo_review BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lead_content_attribution (
    id BIGSERIAL PRIMARY KEY,
    lead_id VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(32),
    source_id VARCHAR(100),
    source_slug VARCHAR(255),
    source_url TEXT,
    service_id VARCHAR(100),
    service_slug VARCHAR(255),
    form_id VARCHAR(100),
    cta_id VARCHAR(100),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    first_touch JSONB,
    last_touch JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_events (
    id BIGSERIAL PRIMARY KEY,
    anonymous_session_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('page_view', 'cta_click', 'form_start', 'form_submit', 'form_error', 'whatsapp_click')),
    content_type VARCHAR(32),
    content_id VARCHAR(100),
    content_slug VARCHAR(255),
    service_id VARCHAR(100),
    service_slug VARCHAR(255),
    form_id VARCHAR(100),
    cta_id VARCHAR(100),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_content_items_status_type ON content_items(status, content_type);
CREATE INDEX idx_content_items_review ON content_items(next_review_at) WHERE status = 'PUBLISHED';
CREATE INDEX idx_content_items_schedule ON content_items(scheduled_at) WHERE status = 'SCHEDULED';
CREATE INDEX idx_content_items_payload_gin ON content_items USING GIN(payload);
CREATE INDEX idx_content_versions_content_created ON content_versions(content_id, created_at DESC);
CREATE INDEX idx_content_history_content_changed ON content_status_history(content_id, changed_at DESC);
CREATE INDEX idx_content_comments_version ON content_comments(version_id, created_at);
CREATE INDEX idx_content_legal_status ON content_legal_sources(status, last_verified_at);
CREATE INDEX idx_content_audit_entity ON content_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_content_events_content_date ON content_events(content_type, content_slug, occurred_at DESC);
CREATE INDEX idx_lead_attribution_service ON lead_content_attribution(service_slug, created_at DESC);
