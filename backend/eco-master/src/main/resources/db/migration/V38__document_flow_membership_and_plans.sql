-- Foundation of the "Документооборот" (document workflow) SaaS module - kz.ecoprogress.documentflow.
-- Reuses kz.eco.company.Company (companies table) as the tenant/organization; no parallel
-- organization entity. This file: memberships + plan catalogue (subscription_plans/plan_features)
-- with the seed matrix for START/BUSINESS/PROFESSIONAL/ENTERPRISE.

CREATE TABLE IF NOT EXISTS document_flow_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    joined_at TIMESTAMP NULL,
    invited_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_document_flow_memberships_org_user UNIQUE (organization_id, user_id),
    CONSTRAINT fk_df_memberships_company FOREIGN KEY (organization_id) REFERENCES companies (id),
    CONSTRAINT fk_df_memberships_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_df_memberships_user ON document_flow_memberships (user_id);
CREATE INDEX idx_df_memberships_org_status ON document_flow_memberships (organization_id, status);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    name_ru VARCHAR(200) NOT NULL,
    name_kk VARCHAR(200) NOT NULL,
    description_ru VARCHAR(2000) NULL,
    description_kk VARCHAR(2000) NULL,
    billing_period VARCHAR(20) NOT NULL,
    price DECIMAL(14,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'KZT',
    trial_days INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    visible TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_subscription_plans_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS plan_features (
    id BIGINT NOT NULL AUTO_INCREMENT,
    plan_id BIGINT NOT NULL,
    feature_code VARCHAR(40) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    limit_value BIGINT NULL,
    metadata_json VARCHAR(2000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_plan_features_plan_feature UNIQUE (plan_id, feature_code),
    CONSTRAINT fk_plan_features_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id)
);

-- Seed matrix (documented business judgement call for this foundation layer - adjust freely
-- later via the admin plan endpoints, this is just a sane starting point):
--   START        15 000 KZT/mo, 14-day trial: module + document creation + versioning only,
--                20 documents/mo, 3 members, 1 GB storage. No signing beyond basic single-party.
--   BUSINESS     45 000 KZT/mo, 14-day trial: adds sequential multi-party signing + audit log,
--                100 documents/mo, 50 signatures/mo, 10 members, 10 GB storage.
--   PROFESSIONAL 90 000 KZT/mo, 14-day trial: adds parallel/mixed signing, external (counterparty)
--                signing, NCALayer CMS signing, templates, API access,
--                500 documents/mo, 300 signatures/mo, 30 external signatures/mo, 30 members, 50 GB.
--   ENTERPRISE   200 000 KZT/mo, 30-day trial: everything on, no numeric limits (NULL = unlimited),
--                including revocation and CRM integration.

INSERT INTO subscription_plans (code, name_ru, name_kk, description_ru, description_kk, billing_period, price, currency, trial_days, active, visible, sort_order, created_at, updated_at)
VALUES
('START', 'Старт', 'Старт', 'Базовый доступ к документообороту для небольших команд', 'Кіші командалар үшін құжат айналымына негізгі қолжетімділік', 'MONTHLY', 15000.00, 'KZT', 14, 1, 1, 1, NOW(), NOW()),
('BUSINESS', 'Бизнес', 'Бизнес', 'Многосторонее подписание и журнал аудита для растущих команд', 'Өсіп келе жатқан командалар үшін көпжақты қол қою және аудит журналы', 'MONTHLY', 45000.00, 'KZT', 14, 1, 1, 2, NOW(), NOW()),
('PROFESSIONAL', 'Профессиональный', 'Кәсіби', 'Внешнее подписание, NCALayer и шаблоны документов', 'Сыртқы қол қою, NCALayer және құжат үлгілері', 'MONTHLY', 90000.00, 'KZT', 14, 1, 1, 3, NOW(), NOW()),
('ENTERPRISE', 'Корпоративный', 'Корпоративтік', 'Полный доступ без ограничений для крупных организаций', 'Ірі ұйымдар үшін шектеусіз толық қолжетімділік', 'MONTHLY', 200000.00, 'KZT', 30, 1, 1, 4, NOW(), NOW())
;

-- START
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_FLOW', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'START';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_CREATE', 1, 20, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'START';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'VERSIONING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'START';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'CUSTOM_LIMITS', 0, NULL, '{"activeMembers":3,"storageBytes":1073741824}', NOW(), NOW() FROM subscription_plans WHERE code = 'START';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, f.code, 0, NULL, NULL, NOW(), NOW() FROM subscription_plans, (
    SELECT 'MULTI_SIGNING' code UNION SELECT 'SEQUENTIAL_SIGNING' UNION SELECT 'PARALLEL_SIGNING' UNION SELECT 'MIXED_SIGNING'
    UNION SELECT 'EXTERNAL_SIGNING' UNION SELECT 'NCALAYER_SIGNING' UNION SELECT 'DOCUMENT_TEMPLATES'
    UNION SELECT 'REVOCATION' UNION SELECT 'AUDIT_LOG' UNION SELECT 'API_ACCESS' UNION SELECT 'CRM_INTEGRATION'
) f WHERE subscription_plans.code = 'START';

-- BUSINESS
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_FLOW', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_CREATE', 1, 100, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'VERSIONING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'MULTI_SIGNING', 1, 50, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'SEQUENTIAL_SIGNING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'AUDIT_LOG', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'CUSTOM_LIMITS', 0, NULL, '{"activeMembers":10,"storageBytes":10737418240}', NOW(), NOW() FROM subscription_plans WHERE code = 'BUSINESS';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, f.code, 0, NULL, NULL, NOW(), NOW() FROM subscription_plans, (
    SELECT 'PARALLEL_SIGNING' code UNION SELECT 'MIXED_SIGNING' UNION SELECT 'EXTERNAL_SIGNING' UNION SELECT 'NCALAYER_SIGNING'
    UNION SELECT 'DOCUMENT_TEMPLATES' UNION SELECT 'REVOCATION' UNION SELECT 'API_ACCESS' UNION SELECT 'CRM_INTEGRATION'
) f WHERE subscription_plans.code = 'BUSINESS';

-- PROFESSIONAL
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_FLOW', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_CREATE', 1, 500, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'VERSIONING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'MULTI_SIGNING', 1, 300, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'SEQUENTIAL_SIGNING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'PARALLEL_SIGNING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'MIXED_SIGNING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'EXTERNAL_SIGNING', 1, 30, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'NCALAYER_SIGNING', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'DOCUMENT_TEMPLATES', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'AUDIT_LOG', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'API_ACCESS', 1, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'CUSTOM_LIMITS', 0, NULL, '{"activeMembers":30,"storageBytes":53687091200}', NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'REVOCATION', 0, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'CRM_INTEGRATION', 0, NULL, NULL, NOW(), NOW() FROM subscription_plans WHERE code = 'PROFESSIONAL';

-- ENTERPRISE - everything enabled, all numeric limits NULL (unlimited)
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, f.code, 1, NULL, NULL, NOW(), NOW() FROM subscription_plans, (
    SELECT 'DOCUMENT_FLOW' code UNION SELECT 'DOCUMENT_CREATE' UNION SELECT 'MULTI_SIGNING' UNION SELECT 'SEQUENTIAL_SIGNING'
    UNION SELECT 'PARALLEL_SIGNING' UNION SELECT 'MIXED_SIGNING' UNION SELECT 'EXTERNAL_SIGNING' UNION SELECT 'NCALAYER_SIGNING'
    UNION SELECT 'DOCUMENT_TEMPLATES' UNION SELECT 'VERSIONING' UNION SELECT 'REVOCATION' UNION SELECT 'AUDIT_LOG'
    UNION SELECT 'API_ACCESS' UNION SELECT 'CRM_INTEGRATION'
) f WHERE subscription_plans.code = 'ENTERPRISE';
INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT id, 'CUSTOM_LIMITS', 1, NULL, '{"activeMembers":null,"storageBytes":null}', NOW(), NOW() FROM subscription_plans WHERE code = 'ENTERPRISE';
