package kz.eco.user;

import java.util.EnumSet;
import java.util.Set;

public enum UserRole {
    CLIENT,
    ADMIN,
    DIRECTOR,
    HEAD,
    MANAGER,
    ACCOUNTANT,
    ECOLOGIST,
    LABORATORY,
    WASTE_SPECIALIST;

    private static final Set<UserRole> STAFF_ROLES = EnumSet.of(
            ADMIN, DIRECTOR, HEAD, MANAGER, ACCOUNTANT, ECOLOGIST, LABORATORY, WASTE_SPECIALIST
    );

    public boolean isStaffAccount() {
        return STAFF_ROLES.contains(this);
    }

    public static Set<UserRole> staffRoles() {
        return STAFF_ROLES;
    }

    public static String[] staffSecurityNames() {
        return STAFF_ROLES.stream().map(Enum::name).toArray(String[]::new);
    }
}
