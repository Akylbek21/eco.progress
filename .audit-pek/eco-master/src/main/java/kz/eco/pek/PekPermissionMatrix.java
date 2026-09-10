package kz.eco.pek;

import kz.eco.user.UserRole;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Authentication-response mirror of the role checks enforced by
 * {@link PekSecurityExpressions}. The frontend deliberately does not infer PEK
 * grants from a role, so these permission codes are the server-owned contract
 * used to expose route-level actions before a concrete PEK resource exists.
 */
public final class PekPermissionMatrix {

    private PekPermissionMatrix() {
    }

    public static Set<String> forRole(UserRole role) {
        if (role == null || !role.isStaffAccount()) {
            return Collections.emptySet();
        }

        Set<String> permissions = new LinkedHashSet<>();
        permissions.add("PEK_VIEW");
        permissions.add("PEK_PROGRAM_VIEW");
        permissions.add("PEK_REPORT_VIEW");
        permissions.add("PEK_REPORT_EXPORT");

        if (Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST).contains(role)) {
            permissions.add("PEK_PROGRAM_CREATE");
            permissions.add("PEK_PROGRAM_EDIT");
            permissions.add("PEK_PROGRAM_SUBMIT");
        }

        if (Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD).contains(role)) {
            permissions.add("PEK_PROGRAM_APPROVE");
            permissions.add("PEK_PROGRAM_ACTIVATE");
            permissions.add("PEK_PROGRAM_ARCHIVE");
            permissions.add("PEK_REPORT_REVIEW");
            permissions.add("PEK_REPORT_RETURN");
            permissions.add("PEK_REPORT_APPROVE");
            permissions.add("PEK_SETTINGS_EDIT");
        }

        if (Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST, UserRole.LABORATORY).contains(role)) {
            permissions.add("PEK_REPORT_CREATE");
            permissions.add("PEK_REPORT_EDIT");
            permissions.add("PEK_REPORT_COLLECT");
            permissions.add("PEK_REPORT_MATCH");
            permissions.add("PEK_REPORT_VALIDATE");
        }

        if (Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.ECOLOGIST).contains(role)) {
            permissions.add("PEK_REPORT_SIGN");
            permissions.add("PEK_REPORT_SUBMIT");
        }

        if (Set.of(UserRole.ADMIN, UserRole.DIRECTOR).contains(role)) {
            permissions.add("PEK_ADMIN");
        }

        return Collections.unmodifiableSet(permissions);
    }
}
