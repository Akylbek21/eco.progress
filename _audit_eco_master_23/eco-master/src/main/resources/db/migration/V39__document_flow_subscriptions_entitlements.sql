-- organization_subscriptions + organization_entitlements + organization_plan_overrides +
-- document_flow_subscription_events (append-only). See kz.ecoprogress.documentflow.subscription
-- and .entitlement packages.

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    starts_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    trial_ends_at TIMESTAMP NULL,
    grace_ends_at TIMESTAMP NULL,
    auto_renew TINYINT(1) NOT NULL DEFAULT 0,
    payment_mode VARCHAR(20) NOT NULL,
    payment_reference VARCHAR(200) NULL,
    activated_by BIGINT NULL,
    suspended_by BIGINT NULL,
    suspension_reason VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_subscriptions_company FOREIGN KEY (organization_id) REFERENCES companies (id),
    CONSTRAINT fk_org_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id)
);

CREATE INDEX idx_org_subscriptions_org ON organization_subscriptions (organization_id);
CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions (status);

-- Note: "at most one non-terminal subscription per organization" is enforced at the service level
-- (kz.ecoprogress.documentflow.subscription.SubscriptionService#grantOrUpdateActive), not by a DB
-- constraint - the non-terminal set (PENDING/TRIAL/ACTIVE/GRACE_PERIOD/SUSPENDED) isn't expressible
-- as a single-column uniqueness rule without a generated/virtual column MySQL versions here may
-- not support consistently; see the ticket for why a DB constraint alone isn't relied upon.

CREATE TABLE IF NOT EXISTS organization_entitlements (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    feature_code VARCHAR(40) NOT NULL,
    enabled TINYINT(1) NOT NULL,
    starts_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    source VARCHAR(20) NOT NULL,
    reason VARCHAR(1000) NULL,
    granted_by BIGINT NULL,
    metadata_json VARCHAR(2000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_entitlements_company FOREIGN KEY (organization_id) REFERENCES companies (id)
);

CREATE INDEX idx_org_entitlements_org_feature ON organization_entitlements (organization_id, feature_code);
CREATE INDEX idx_org_entitlements_expires ON organization_entitlements (expires_at);

CREATE TABLE IF NOT EXISTS organization_plan_overrides (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    feature_code VARCHAR(40) NOT NULL,
    limit_value BIGINT NULL,
    -- Disambiguates STORAGE_BYTES vs ACTIVE_MEMBERS when feature_code=CUSTOM_LIMITS - see
    -- kz.ecoprogress.documentflow.entitlement.OverrideMetricTag javadoc (documented deviation from
    -- the literal field list in the module spec).
    metric VARCHAR(40) NULL,
    starts_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    reason VARCHAR(1000) NULL,
    granted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_org_plan_overrides_company FOREIGN KEY (organization_id) REFERENCES companies (id)
);

CREATE INDEX idx_org_plan_overrides_org_feature ON organization_plan_overrides (organization_id, feature_code);

CREATE TABLE IF NOT EXISTS document_flow_subscription_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    subscription_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NULL,
    reason VARCHAR(1000) NULL,
    actor_user_id BIGINT NULL,
    metadata_json VARCHAR(2000) NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_df_sub_events_subscription ON document_flow_subscription_events (subscription_id);
CREATE INDEX idx_df_sub_events_org ON document_flow_subscription_events (organization_id);
