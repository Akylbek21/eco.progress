package kz.eco.pek;

import kz.eco.user.UserRole;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * The PEK_* permission names advertised to the frontend in {@code /api/auth/me}, resolved per
 * {@link UserRole}.
 *
 * <p><b>This class does not define a second permission model.</b> It is derived at class-init by
 * parsing the role lists out of the very same {@link PekSecurityExpressions} SpEL constants that
 * {@code @PreAuthorize} evaluates on the controllers. That is deliberate: a hand-maintained copy
 * of the matrix would silently drift from the real gates, and drift here is precisely the bug
 * class that hurts users - the UI enables a button the backend then answers with 403, or hides
 * one the user is actually entitled to. Change a role list in {@code PekSecurityExpressions} and
 * this matrix follows automatically.
 *
 * <p>Consequently this is <b>advisory data for rendering</b>, never an authorization decision.
 * Every endpoint keeps its own {@code @PreAuthorize} plus the company-scope checks in
 * {@link PekAccessService}; a client that fabricates permissions gains nothing.
 *
 * <p><b>Aliases.</b> The frontend distinguishes a few actions that the backend intentionally
 * gates with a coarser expression (e.g. "submit a program for review" is guarded by
 * {@code PEK_PROGRAM_EDIT}, since submitting is an authoring action on a DRAFT). Those names are
 * mapped to the expression that genuinely guards the endpoint, so an advertised permission always
 * means "the backend will really let you do this".
 */
public final class PekPermissionMatrix {

    /** Advertised permission name -> the SpEL expression that actually gates it on the controller.
     *  Where the two names differ, the comment names the endpoint that was checked. */
    private static final Map<String, String> PERMISSION_GATES = new LinkedHashMap<>();

    static {
        PERMISSION_GATES.put("PEK_VIEW", PekSecurityExpressions.PEK_VIEW);
        // Programs
        PERMISSION_GATES.put("PEK_PROGRAM_VIEW", PekSecurityExpressions.PEK_VIEW);
        PERMISSION_GATES.put("PEK_PROGRAM_CREATE", PekSecurityExpressions.PEK_PROGRAM_CREATE);
        PERMISSION_GATES.put("PEK_PROGRAM_EDIT", PekSecurityExpressions.PEK_PROGRAM_EDIT);
        // POST /api/pek/programs/{id}/submit-review is gated by PEK_PROGRAM_EDIT.
        PERMISSION_GATES.put("PEK_PROGRAM_SUBMIT", PekSecurityExpressions.PEK_PROGRAM_EDIT);
        PERMISSION_GATES.put("PEK_PROGRAM_REVIEW", PekSecurityExpressions.PEK_PROGRAM_REVIEW);
        PERMISSION_GATES.put("PEK_PROGRAM_APPROVE", PekSecurityExpressions.PEK_PROGRAM_APPROVE);
        PERMISSION_GATES.put("PEK_PROGRAM_ACTIVATE", PekSecurityExpressions.PEK_PROGRAM_ACTIVATE);
        PERMISSION_GATES.put("PEK_PROGRAM_ARCHIVE", PekSecurityExpressions.PEK_PROGRAM_ARCHIVE);
        // Reports
        PERMISSION_GATES.put("PEK_REPORT_VIEW", PekSecurityExpressions.PEK_VIEW);
        PERMISSION_GATES.put("PEK_REPORT_CREATE", PekSecurityExpressions.PEK_REPORT_CREATE);
        PERMISSION_GATES.put("PEK_REPORT_EDIT", PekSecurityExpressions.PEK_REPORT_EDIT);
        PERMISSION_GATES.put("PEK_REPORT_COLLECT", PekSecurityExpressions.PEK_REPORT_COLLECT);
        // POST /api/pek/reports/{id}/sources/{sourceId}/match is gated by PEK_REPORT_EDIT.
        PERMISSION_GATES.put("PEK_REPORT_MATCH", PekSecurityExpressions.PEK_REPORT_EDIT);
        PERMISSION_GATES.put("PEK_REPORT_VALIDATE", PekSecurityExpressions.PEK_REPORT_VALIDATE);
        PERMISSION_GATES.put("PEK_REPORT_REVIEW", PekSecurityExpressions.PEK_REPORT_REVIEW);
        PERMISSION_GATES.put("PEK_REPORT_RETURN", PekSecurityExpressions.PEK_REPORT_RETURN);
        PERMISSION_GATES.put("PEK_REPORT_APPROVE", PekSecurityExpressions.PEK_REPORT_APPROVE);
        PERMISSION_GATES.put("PEK_REPORT_SIGN", PekSecurityExpressions.PEK_REPORT_SIGN);
        PERMISSION_GATES.put("PEK_REPORT_SUBMIT", PekSecurityExpressions.PEK_REPORT_SUBMIT);
        PERMISSION_GATES.put("PEK_REPORT_EXPORT", PekSecurityExpressions.PEK_REPORT_EXPORT);
        // Settings / administration
        PERMISSION_GATES.put("PEK_SETTINGS_VIEW", PekSecurityExpressions.PEK_SETTINGS_VIEW);
        PERMISSION_GATES.put("PEK_SETTINGS_EDIT", PekSecurityExpressions.PEK_SETTINGS_EDIT);
        PERMISSION_GATES.put("PEK_ADMIN", PekSecurityExpressions.PEK_ADMIN);
    }

    /** Matches each quoted role inside {@code hasAnyRole('ADMIN','DIRECTOR')}. */
    private static final Pattern ROLE_LITERAL = Pattern.compile("'([A-Z_]+)'");

    private static final Map<UserRole, Set<String>> MATRIX = buildMatrix();

    private static Map<UserRole, Set<String>> buildMatrix() {
        Map<UserRole, Set<String>> matrix = new EnumMap<>(UserRole.class);
        for (UserRole role : UserRole.values()) {
            matrix.put(role, PERMISSION_GATES.entrySet().stream()
                    .filter(entry -> rolesOf(entry.getValue()).contains(role.name()))
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toCollection(java.util.LinkedHashSet::new)));
        }
        return matrix;
    }

    private static Set<String> rolesOf(String spel) {
        Set<String> roles = new java.util.LinkedHashSet<>();
        Matcher matcher = ROLE_LITERAL.matcher(spel);
        while (matcher.find()) {
            roles.add(matcher.group(1));
        }
        if (roles.isEmpty()) {
            // A PEK expression that names no role would silently grant nothing to everyone, which
            // would look exactly like the "ADMIN sees PEK but cannot act" bug this class fixes.
            throw new IllegalStateException("PEK permission expression names no role: " + spel);
        }
        return roles;
    }

    /** Permissions for the given role; empty for {@code null} and for roles outside the PEK
     *  matrix (notably {@code CLIENT}, which never appears in a PEK role list). Immutable. */
    public static Set<String> forRole(UserRole role) {
        if (role == null) {
            return Set.of();
        }
        return java.util.Collections.unmodifiableSet(MATRIX.getOrDefault(role, Set.of()));
    }

    /** Every permission name this matrix can advertise - used by tests to pin the contract. */
    public static Set<String> allPermissions() {
        return java.util.Collections.unmodifiableSet(PERMISSION_GATES.keySet());
    }

    private PekPermissionMatrix() {
    }
}
