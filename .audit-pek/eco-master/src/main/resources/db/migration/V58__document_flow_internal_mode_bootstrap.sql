-- Internal-mode bootstrap for the "Документооборот" module (spec: "администратор EcoProgress
-- должен уметь работать без ручных настроек подписки/тарифа"). Idempotent - every statement is
-- guarded so re-running this migration (or applying it against a database that already has the
-- row from a previous partial run) never creates a duplicate.
--
-- 1. Ensure the EcoProgress company row exists - reused as the document-flow tenant
--    (organization_id everywhere in this module IS companies.id, see DocumentFlowMembership
--    javadoc). BIN below is a clearly-marked internal placeholder, not a real registration number -
--    replace it via UPDATE once the real EcoProgress BIN is on hand, this migration only needs the
--    row to exist under the recognizable name 'EcoProgress'.
INSERT INTO companies (name, bin, legal_address, phone, email, status, created_at, updated_at)
SELECT 'EcoProgress', '000000000001', 'г. Алматы', '+77000000000', 'info@ecoprogress.kz', 'ACTIVE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'EcoProgress');

-- 2. INTERNAL plan: zero price, every document-flow feature enabled, no seat/storage limit -
--    internal company usage should never be blocked by the same commercial gates real customers
--    go through (module spec §3: "не блокировать внутреннюю работу из-за отсутствующей
--    коммерческой подписки").
INSERT INTO subscription_plans (code, name_ru, name_kk, description_ru, description_kk, billing_period, price, currency, trial_days, active, visible, sort_order, created_at, updated_at)
SELECT 'INTERNAL', 'Внутренний (EcoProgress)', 'Ішкі (EcoProgress)',
       'Безлимитный внутренний доступ для сотрудников EcoProgress', 'EcoProgress қызметкерлері үшін шексіз ішкі қолжетімділік',
       'MONTHLY', 0.00, 'KZT', 0, 1, 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'INTERNAL');

INSERT INTO plan_features (plan_id, feature_code, enabled, limit_value, metadata_json, created_at, updated_at)
SELECT p.id, f.code, 1, NULL, NULL, NOW(), NOW()
FROM subscription_plans p,
     (SELECT 'DOCUMENT_FLOW' code UNION SELECT 'DOCUMENT_CREATE' UNION SELECT 'MULTI_SIGNING'
      UNION SELECT 'SEQUENTIAL_SIGNING' UNION SELECT 'PARALLEL_SIGNING' UNION SELECT 'MIXED_SIGNING'
      UNION SELECT 'EXTERNAL_SIGNING' UNION SELECT 'NCALAYER_SIGNING' UNION SELECT 'DOCUMENT_TEMPLATES'
      UNION SELECT 'VERSIONING' UNION SELECT 'REVOCATION' UNION SELECT 'AUDIT_LOG'
      UNION SELECT 'API_ACCESS' UNION SELECT 'CRM_INTEGRATION') f
WHERE p.code = 'INTERNAL'
  AND NOT EXISTS (SELECT 1 FROM plan_features pf WHERE pf.plan_id = p.id AND pf.feature_code = f.code);

-- 3. Give EcoProgress an ACTIVE subscription to the INTERNAL plan - ADMIN_GRANT payment mode marks
--    this as never expiring / never billed, matching the plan's own zero price.
INSERT INTO organization_subscriptions (organization_id, plan_id, status, starts_at, auto_renew, payment_mode, created_at, updated_at)
SELECT c.id, p.id, 'ACTIVE', NOW(), 0, 'ADMIN_GRANT', NOW(), NOW()
FROM companies c, subscription_plans p
WHERE c.name = 'EcoProgress' AND p.code = 'INTERNAL'
  AND NOT EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id = c.id);

-- 4. Every existing system ADMIN gets an ACTIVE OWNER membership of EcoProgress in the
--    document-flow module (module spec §2.4: auto-provision on first access) - done here as a
--    one-time backfill for admins that already existed before this migration; new ADMIN users
--    created after this point are provisioned at runtime by OrganizationResolver instead (there is
--    no migration that can run for a user who doesn't exist yet).
INSERT INTO document_flow_memberships (organization_id, user_id, role_code, status, joined_at, created_at, updated_at, version)
SELECT c.id, u.id, 'OWNER', 'ACTIVE', NOW(), NOW(), NOW(), 0
FROM companies c, users u
WHERE c.name = 'EcoProgress' AND u.role = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM document_flow_memberships m WHERE m.organization_id = c.id AND m.user_id = u.id
  );
