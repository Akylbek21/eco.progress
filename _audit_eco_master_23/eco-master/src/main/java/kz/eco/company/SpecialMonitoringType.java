package kz.eco.company;

/**
 * Whether a facility falls under a special monitoring regime that changes its statutory reporting
 * obligations.
 *
 * <p>Lives on {@link CompanyObject} and not on {@link Company}: one company can operate several
 * facilities, only some of which are in the Kazakhstani sector of the Caspian Sea, and a
 * company-level flag would give every one of its facilities the Caspian deadline.
 *
 * <p>Set explicitly, never inferred. It would be technically possible to guess CASPIAN_MARINE from
 * a facility's coordinates or КАТО code, but no rule defines that boundary for reporting purposes,
 * so a guess would silently move a statutory deadline on the strength of a geometry this system
 * invented. A wrong guess in either direction is a missed or premature filing.
 */
public enum SpecialMonitoringType {

    /** Ordinary facility - no special regime. */
    NONE,

    /**
     * Environmental monitoring in the Kazakhstani sector of the Caspian Sea, which the rules give a
     * later annual deadline than ordinary reporting.
     */
    CASPIAN_MARINE
}
