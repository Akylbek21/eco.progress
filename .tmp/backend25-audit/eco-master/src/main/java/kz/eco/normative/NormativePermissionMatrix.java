package kz.eco.normative;

import kz.eco.user.SecurityExpressions;
import kz.eco.user.UserRole;

import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NORMATIVE_* permission names advertised to the frontend in {@code /api/auth/me}. Same approach
 * as {@link kz.eco.pek.PekPermissionMatrix}: role sets are parsed out of the very
 * {@link SecurityExpressions} constants that {@code @PreAuthorize} evaluates on the normative
 * controllers, so the advertised matrix can't drift from the real gates. Advisory only.
 */
public final class NormativePermissionMatrix {

    private static final Map<String, String> PERMISSION_GATES = new LinkedHashMap<>();

    static {
        PERMISSION_GATES.put("NORMATIVE_VIEW", SecurityExpressions.NORMATIVE_VIEW);
        PERMISSION_GATES.put("NORMATIVE_CREATE", SecurityExpressions.NORMATIVE_EDIT);
        PERMISSION_GATES.put("NORMATIVE_EDIT", SecurityExpressions.NORMATIVE_EDIT);
        PERMISSION_GATES.put("NORMATIVE_ARCHIVE", SecurityExpressions.NORMATIVE_ARCHIVE);
        PERMISSION_GATES.put("NORMATIVE_RESTORE", SecurityExpressions.NORMATIVE_ARCHIVE);
        PERMISSION_GATES.put("NORMATIVE_IMPORT", SecurityExpressions.NORMATIVE_IMPORT);
        PERMISSION_GATES.put("NORMATIVE_IMPORT_ROLLBACK", SecurityExpressions.NORMATIVE_IMPORT_ROLLBACK);
    }

    private static final Pattern ROLE_LITERAL = Pattern.compile("'([A-Z_]+)'");

    private static final Map<UserRole, Set<String>> MATRIX = buildMatrix();

    private static Map<UserRole, Set<String>> buildMatrix() {
        Map<UserRole, Set<String>> matrix = new EnumMap<>(UserRole.class);
        for (UserRole role : UserRole.values()) {
            Set<String> granted = new LinkedHashSet<>();
            PERMISSION_GATES.forEach((permission, spel) -> {
                if (rolesOf(spel).contains(role.name())) {
                    granted.add(permission);
                }
            });
            matrix.put(role, Collections.unmodifiableSet(granted));
        }
        return matrix;
    }

    private static Set<String> rolesOf(String spel) {
        Set<String> roles = new LinkedHashSet<>();
        Matcher matcher = ROLE_LITERAL.matcher(spel);
        while (matcher.find()) {
            roles.add(matcher.group(1));
        }
        if (roles.isEmpty()) {
            throw new IllegalStateException("Normative permission expression names no role: " + spel);
        }
        return roles;
    }

    public static Set<String> forRole(UserRole role) {
        return role == null ? Set.of() : MATRIX.getOrDefault(role, Set.of());
    }

    private NormativePermissionMatrix() {
    }
}
