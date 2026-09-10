package kz.ecoprogress.documentflow.membership;

import kz.ecoprogress.documentflow.access.DocumentFlowPermission;

import java.util.EnumSet;
import java.util.Set;

import static kz.ecoprogress.documentflow.access.DocumentFlowPermission.*;

/**
 * Role codes stored as a plain string on {@link DocumentFlowMembership#getRoleCode()} (the
 * ticket's field is {@code roleCode: String}) but modeled here as an enum for the
 * role -> permission matrix below and for compile-time safety everywhere else in the module.
 * {@link DocumentFlowMembership} stores {@code @Enumerated(STRING)} against this type.
 *
 * Default permission matrix - deliberately simple for this foundation layer (no per-membership
 * permission overrides yet); Agents B/C should treat this as the full source of truth for "can
 * this membership do X" until a custom-override mechanism is added.
 */
public enum MembershipRole {
    /** Organization owner - implicitly created on first ACTIVE grant; every permission. */
    OWNER(EnumSet.allOf(DocumentFlowPermission.class)),
    /** Day-to-day module administrator - everything except subscription management. */
    DOCUMENT_FLOW_ADMIN(EnumSet.of(VIEW_DOCUMENTS, CREATE_DOCUMENT, EDIT_DOCUMENT, DELETE_DOCUMENT,
            SIGN_DOCUMENT, SIGN_EXTERNAL, REVOKE_SIGNATURE, MANAGE_MEMBERS, MANAGE_COUNTERPARTIES,
            MANAGE_TEMPLATES, VIEW_AUDIT_LOG)),
    DOCUMENT_MANAGER(EnumSet.of(VIEW_DOCUMENTS, CREATE_DOCUMENT, EDIT_DOCUMENT, MANAGE_COUNTERPARTIES,
            MANAGE_TEMPLATES)),
    SIGNER(EnumSet.of(VIEW_DOCUMENTS, SIGN_DOCUMENT)),
    ACCOUNTANT(EnumSet.of(VIEW_DOCUMENTS, VIEW_AUDIT_LOG)),
    VIEWER(EnumSet.of(VIEW_DOCUMENTS)),
    /** Not an organization member in the normal sense - a counterparty-side signer invited to
     *  sign one specific document from outside the organization. Scoped narrowly on purpose. */
    EXTERNAL_SIGNER(EnumSet.of(SIGN_EXTERNAL));

    private final Set<DocumentFlowPermission> defaultPermissions;

    MembershipRole(Set<DocumentFlowPermission> defaultPermissions) {
        this.defaultPermissions = defaultPermissions;
    }

    public Set<DocumentFlowPermission> defaultPermissions() {
        return defaultPermissions;
    }
}
