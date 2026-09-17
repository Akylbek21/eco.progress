package kz.ecoprogress.documentflow.access;

/**
 * Fine-grained action permissions inside the module, granted per
 * {@link kz.ecoprogress.documentflow.membership.MembershipRole} (see that enum's
 * {@code defaultPermissions()} for the role -> permission matrix). Independent of
 * {@link kz.ecoprogress.documentflow.plan.FeatureCode} (a plan/entitlement gate on the
 * organization as a whole) - a user can hold a permission that the org's plan doesn't currently
 * unlock, in which case {@link DocumentFlowAccessService#requireFeature} is the blocking check.
 */
public enum DocumentFlowPermission {
    VIEW_DOCUMENTS,
    CREATE_DOCUMENT,
    EDIT_DOCUMENT,
    DELETE_DOCUMENT,
    SIGN_DOCUMENT,
    SIGN_EXTERNAL,
    REVOKE_SIGNATURE,
    MANAGE_MEMBERS,
    MANAGE_COUNTERPARTIES,
    MANAGE_TEMPLATES,
    VIEW_AUDIT_LOG,
    MANAGE_SUBSCRIPTION
}
