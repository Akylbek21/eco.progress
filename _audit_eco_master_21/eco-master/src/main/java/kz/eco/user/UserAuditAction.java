package kz.eco.user;

/** Audit action types written to {@code audit_logs} for the staff-account lifecycle
 *  (ADMIN creates employee -> pending_setup -> one-time setup link -> ACTIVE).
 *  Entity type is {@link #ENTITY_TYPE}; the entity id is the affected user's id.
 *
 *  <p>None of these entries may ever carry a raw password, a password hash, or a raw setup
 *  token - only the fact that the event happened plus non-secret identifiers.</p> */
public final class UserAuditAction {

    public static final String ENTITY_TYPE = "USER";

    public static final String USER_CREATED = "USER_CREATED";
    public static final String SETUP_LINK_CREATED = "SETUP_LINK_CREATED";
    public static final String PASSWORD_SETUP_COMPLETED = "PASSWORD_SETUP_COMPLETED";
    public static final String USER_UPDATED = "USER_UPDATED";
    public static final String USER_STATUS_CHANGED = "USER_STATUS_CHANGED";
    public static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
    public static final String USER_DELETED = "USER_DELETED";

    private UserAuditAction() {
    }
}
