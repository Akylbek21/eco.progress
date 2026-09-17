package kz.eco.auth;

import kz.eco.common.exception.UnauthorizedException;
import kz.eco.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static User get() {
        User user = getOrNull();
        if (user == null) {
            throw new UnauthorizedException("Требуется авторизация");
        }
        return user;
    }

    public static User getOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() == null) {
            return null;
        }
        Object principal = auth.getPrincipal();
        return principal instanceof User u ? u : null;
    }
}
