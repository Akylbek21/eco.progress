package kz.eco.pek;

/**
 * Granular PEK_* permission matrix (module spec §19), replacing the single blanket
 * {@link kz.eco.user.SecurityExpressions#STAFF} check that used to gate every PEK endpoint
 * identically regardless of action. Follows the same role-union SpEL pattern as
 * {@link kz.eco.user.SecurityExpressions} - no new permission-table infrastructure, just finer
 * per-action role sets on top of the roles that already exist.
 */
public final class PekSecurityExpressions {

    /** Read-only access - list/get programs and reports. Same role set as the old blanket STAFF
     *  check, since read access was never the problem the audit flagged. */
    public static final String PEK_VIEW =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')";

    /** Create/edit a program (still DRAFT, so reversible). */
    public static final String PEK_PROGRAM_CREATE =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','ECOLOGIST')";
    public static final String PEK_PROGRAM_EDIT = PEK_PROGRAM_CREATE;

    /** Activating a program locks it in as the object's binding control plan - narrower than
     *  create/edit, mirrors PROTOCOL_SUPERVISOR's "only supervisors finalize" pattern. */
    public static final String PEK_PROGRAM_ACTIVATE =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    public static final String PEK_PROGRAM_ARCHIVE = PEK_PROGRAM_ACTIVATE;

    /** Returning a submitted program for correction / approving it - supervisor-only, the author
     *  of a DRAFT should not also be the one who reviews/approves their own submission (module
     *  spec §23). */
    public static final String PEK_PROGRAM_REVIEW =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    public static final String PEK_PROGRAM_APPROVE = PEK_PROGRAM_REVIEW;

    /** Report authoring/data-collection - same operational roles as program authoring, plus
     *  LABORATORY since report data collection pulls from lab protocols. */
    public static final String PEK_REPORT_CREATE =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','ECOLOGIST','LABORATORY')";
    public static final String PEK_REPORT_EDIT = PEK_REPORT_CREATE;
    public static final String PEK_REPORT_COLLECT = PEK_REPORT_CREATE;
    public static final String PEK_REPORT_VALIDATE = PEK_REPORT_CREATE;

    /** Review/approve/return-for-revision - supervisor-only, same rationale as
     *  PROTOCOL_SUPERVISOR: the author of a report should not also be the one who approves it. */
    public static final String PEK_REPORT_REVIEW =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    public static final String PEK_REPORT_RETURN = PEK_REPORT_REVIEW;
    public static final String PEK_REPORT_APPROVE = PEK_REPORT_REVIEW;

    public static final String PEK_REPORT_SIGN =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','ECOLOGIST')";
    public static final String PEK_REPORT_SUBMIT = PEK_REPORT_REVIEW;
    public static final String PEK_REPORT_EXPORT = PEK_VIEW;

    public static final String PEK_ADMIN =
            "hasAnyRole('ADMIN','DIRECTOR')";

    private PekSecurityExpressions() {
    }
}
