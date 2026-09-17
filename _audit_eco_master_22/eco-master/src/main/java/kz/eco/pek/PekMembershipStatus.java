package kz.eco.pek;

/**
 * Lifecycle of a {@link PekCompanyMembership} row. INVITED is reserved for a future invitation
 * flow (not implemented in Iteration 1 - memberships are seeded directly as ACTIVE); REMOVED is a
 * soft-delete so historical audit/history rows referencing a membership never dangle.
 */
public enum PekMembershipStatus {
    ACTIVE,
    INVITED,
    REMOVED
}
