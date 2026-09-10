package kz.ecoprogress.documentflow.access;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Backs {@code document-flow.internal-mode} / {@code document-flow.default-organization-id}: lets
 * EcoProgress staff use the document-flow module against one fixed internal organization without
 * a commercial subscription or per-request {@code organizationId}, while keeping the exact same
 * membership/permission checks external tenants go through (see
 * {@link OrganizationResolver#resolve}). The organization id itself is never hardcoded in Java -
 * it is either supplied explicitly via env var (required in production, per the module spec) or
 * resolved by name at runtime from the row V58__document_flow_internal_mode_bootstrap.sql creates.
 */
@Component
@ConfigurationProperties(prefix = "document-flow")
public class DocumentFlowInternalModeProperties {

    /** Name to resolve the default organization by when {@link #defaultOrganizationId} is not
     *  explicitly configured - matches the company V58 bootstraps. */
    public static final String DEFAULT_ORGANIZATION_NAME = "EcoProgress";

    private boolean internalMode = false;
    private Long defaultOrganizationId;

    public boolean isInternalMode() { return internalMode; }
    public void setInternalMode(boolean internalMode) { this.internalMode = internalMode; }
    public Long getDefaultOrganizationId() { return defaultOrganizationId; }
    public void setDefaultOrganizationId(Long defaultOrganizationId) { this.defaultOrganizationId = defaultOrganizationId; }
}
