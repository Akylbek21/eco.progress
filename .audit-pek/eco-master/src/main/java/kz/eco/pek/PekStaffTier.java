package kz.eco.pek;

import kz.eco.user.UserRole;

import java.util.EnumSet;
import java.util.Set;

/** Company-scoped PEK permission tier for OUR staff assigned to a client company - replaces the
 *  old design flaw where {@code PekCompanyMembership.roleCode} directly reused the global
 *  {@link UserRole} enum (so a membership's "role" was really just a copy of the user's own
 *  account role, not a real per-company permission tier, and nothing stopped assigning a CLIENT-
 *  role account as if it were PEK staff of that company). VIEWER is the default/lowest tier. */
public enum PekStaffTier {
    VIEWER,
    EDITOR,
    REVIEWER;

    private static final Set<UserRole> REVIEWER_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);
    private static final Set<UserRole> EDITOR_ROLES =
            EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST);

    /** Best-effort default tier for a staff user's global account role, matching the permission
     *  boundaries the old EDIT_MEMBERSHIP_ROLES/REVIEW_MEMBERSHIP_ROLES sets in PekAccessService
     *  used to encode inline - kept only as a sensible default when assigning staff, never
     *  re-derived at access-check time (the persisted tier is always the source of truth). */
    public static PekStaffTier defaultForRole(UserRole role) {
        if (role != null && REVIEWER_ROLES.contains(role)) {
            return REVIEWER;
        }
        if (role != null && EDITOR_ROLES.contains(role)) {
            return EDITOR;
        }
        return VIEWER;
    }

    public boolean atLeast(PekStaffTier required) {
        return this.ordinal() >= required.ordinal();
    }
}
