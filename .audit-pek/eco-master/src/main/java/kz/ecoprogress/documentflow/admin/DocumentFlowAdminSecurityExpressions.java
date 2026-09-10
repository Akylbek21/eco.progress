package kz.ecoprogress.documentflow.admin;

/**
 * SpEL constants for {@code @PreAuthorize} on {@code /api/admin/document-flow/**} endpoints,
 * following the same pattern as {@link kz.eco.user.SecurityExpressions} /
 * {@link kz.eco.pek.PekSecurityExpressions} - there is no granular {@code hasAuthority(...)}
 * permission model anywhere in this codebase yet, only role-based {@code hasAnyRole(...)} string
 * constants, so all four constants below resolve to the same {@code hasRole('ADMIN')} check today.
 *
 * <p>The point of splitting them into four distinct names now - VIEW/MANAGE/PLAN_MANAGE/
 * MEMBER_MANAGE - rather than reusing {@code SecurityExpressions.ADMIN_ONLY} everywhere, is that a
 * future finer-grained split (e.g. a read-only "support" role that can view subscriptions but not
 * mutate them) becomes a one-line change per constant instead of an audit-and-rewrite of every
 * {@code @PreAuthorize} annotation in this package.
 */
public final class DocumentFlowAdminSecurityExpressions {

    private DocumentFlowAdminSecurityExpressions() {
    }

    /** Read-only: list/detail/events endpoints. */
    public static final String DOCUMENT_FLOW_ACCESS_VIEW = "hasRole('ADMIN')";

    /** Subscription-lifecycle mutations: grant/extend/suspend/restore/revoke. */
    public static final String DOCUMENT_FLOW_ACCESS_MANAGE = "hasRole('ADMIN')";

    /** Plan/limits/entitlements mutations: change-plan/limits/entitlements. */
    public static final String DOCUMENT_FLOW_PLAN_MANAGE = "hasRole('ADMIN')";

    /** Admin-driven member management: the /organizations/{organizationId}/members/** endpoints. */
    public static final String DOCUMENT_FLOW_MEMBER_MANAGE = "hasRole('ADMIN')";
}
