package kz.ecoprogress.documentflow.access;

import kz.ecoprogress.documentflow.plan.FeatureCode;

/**
 * The single entry point Agents B (documents/versions/attachments/counterparties) and C
 * (signing/CMS/external signing/revocation) call for every access decision. Do not query
 * memberships/subscriptions/entitlements/plans directly from those modules - route everything
 * through here so the business rules stay centralized.
 *
 * <p><b>Critical caller contract - read before using:</b> every {@code organizationId} parameter
 * below MUST come from an already-validated membership lookup performed by the caller (e.g.
 * "load the current user's membership row for the organization referenced by the document/
 * envelope being acted on, then pass that membership's organizationId here") - never pass an
 * organizationId taken directly from a client-supplied request body/path/query parameter without
 * first confirming, via your own membership check, that the current user is actually a member of
 * that organization. This service does perform its own defensive membership check internally
 * (throwing {@link DocumentFlowMembershipRequiredException} if none exists) as a second line of
 * defense, but that is not a substitute for resolving the organizationId correctly in the first
 * place - a caller that blindly forwards a client-supplied organizationId for a DIFFERENT
 * legitimate operation (e.g. reusing another organization's id to probe feature flags) can still
 * leak information even though the write itself would ultimately be denied.
 *
 * <p><b>Read-only / status policy</b> (see AccessContext for the full data shape):
 * <ul>
 *   <li>ACTIVE/TRIAL: full access per plan + permissions.</li>
 *   <li>GRACE_PERIOD: full write access still allowed; reason carries a warning.</li>
 *   <li>EXPIRED/CANCELLED: read-only; {@link #requireWriteAccess} throws
 *       {@link DocumentFlowReadOnlyException}; {@link #requireActiveAccess} still succeeds.</li>
 *   <li>SUSPENDED: fully closed; both require* methods throw
 *       {@link DocumentFlowAccessSuspendedException}.</li>
 *   <li>PENDING or no subscription row at all: fully closed; both require* methods throw
 *       {@link DocumentFlowSubscriptionRequiredException}.</li>
 *   <li>No membership at all for (userId, organizationId): both require* methods throw
 *       {@link DocumentFlowMembershipRequiredException} regardless of subscription state.</li>
 * </ul>
 */
public interface DocumentFlowAccessService {

    /** Full state snapshot - never throws for business-state reasons (no membership/no
     *  subscription/suspended all just show up as fields on the returned context), so it's safe
     *  to call for "describe why this is blocked" UIs. */
    AccessContext getAccessContext(Long userId, Long organizationId);

    boolean canOpenModule(Long userId, Long organizationId);

    boolean hasFeature(Long organizationId, FeatureCode feature);

    boolean hasPermission(Long userId, Long organizationId, DocumentFlowPermission permission);

    /** Throwing counterpart to {@link #hasPermission} - the guard every read/write endpoint that
     *  needs a specific fine-grained permission (VIEW_DOCUMENTS, SIGN_DOCUMENT, REVOKE_SIGNATURE,
     *  ...) should call, scoped to the RESOURCE's real organizationId (e.g. the document's, or the
     *  revocation request's document's), never a client-supplied one. Throws
     *  {@link DocumentFlowMembershipRequiredException} if there is no ACTIVE membership at all, or
     *  {@link org.springframework.security.access.AccessDeniedException} if the membership is
     *  ACTIVE but its role does not grant the permission. This is the fix for the confirmed IDOR
     *  gap where signing-route/signature/verification-report/signed-package/revocation endpoints
     *  called their services with no access check whatsoever. */
    void requirePermission(Long userId, Long organizationId, DocumentFlowPermission permission);

    /** Throws {@link DocumentFlowMembershipRequiredException}, {@link DocumentFlowSubscriptionRequiredException},
     *  or {@link DocumentFlowAccessSuspendedException} if the module is closed; otherwise returns
     *  normally (read access, including read-only EXPIRED/CANCELLED state, is fine). */
    void requireActiveAccess(Long userId, Long organizationId);

    /** Throws the same as {@link #requireActiveAccess} for closed states, plus
     *  {@link DocumentFlowReadOnlyException} if the subscription is EXPIRED/CANCELLED. */
    void requireWriteAccess(Long userId, Long organizationId);

    /** Throws {@link DocumentFlowFeatureNotAvailableException} if the feature resolves to
     *  disabled for the organization (see kz.ecoprogress.documentflow.entitlement.EntitlementResolver
     *  for the plan-vs-entitlement priority rule). Does not check membership/subscription status -
     *  callers should also call {@link #requireActiveAccess} or {@link #requireWriteAccess} as
     *  appropriate. */
    void requireFeature(Long organizationId, FeatureCode feature);
}
