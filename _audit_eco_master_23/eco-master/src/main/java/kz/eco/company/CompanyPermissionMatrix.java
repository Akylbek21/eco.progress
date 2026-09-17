package kz.eco.company;

import kz.eco.user.UserRole;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Single source-of-truth mirror of the COMPANY_* role sets enforced by
 * {@link kz.eco.user.SecurityExpressions}' {@code @PreAuthorize} expressions on
 * {@link CompanyController} - computed once per request and returned from {@code GET /api/auth/me}
 * so the frontend can show/hide actions without guessing the role matrix itself. This is a
 * convenience mirror, never the actual access-control boundary: every endpoint still enforces its
 * own {@code @PreAuthorize} (and, for company-scoped endpoints, {@link CompanyAccessService})
 * independently of what this map says. Keep the role sets below in lockstep with
 * {@code SecurityExpressions.COMPANY_ACCESS/COMPANY_EDIT/COMPANY_ARCHIVE} - if they diverge, the
 * frontend and backend will disagree about what's allowed.
 */
public final class CompanyPermissionMatrix {

    private CompanyPermissionMatrix() {
    }

    public static Map<String, Boolean> forRole(UserRole role) {
        boolean view = has(role, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.MANAGER, UserRole.LABORATORY);
        boolean edit = has(role, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.MANAGER);
        boolean archive = has(role, UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);
        Map<String, Boolean> permissions = new LinkedHashMap<>();
        permissions.put("COMPANY_VIEW", view);
        permissions.put("COMPANY_CREATE", edit);
        permissions.put("COMPANY_EDIT", edit);
        permissions.put("COMPANY_ARCHIVE", archive);
        permissions.put("COMPANY_CREATE_OBJECT", edit);
        permissions.put("COMPANY_EDIT_OBJECT", edit);
        permissions.put("COMPANY_ARCHIVE_OBJECT", archive);
        return permissions;
    }

    private static boolean has(UserRole role, UserRole... allowed) {
        if (role == null) {
            return false;
        }
        for (UserRole candidate : allowed) {
            if (candidate == role) {
                return true;
            }
        }
        return false;
    }
}
