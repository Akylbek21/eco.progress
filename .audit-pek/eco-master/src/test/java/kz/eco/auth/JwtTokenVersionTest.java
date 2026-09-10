package kz.eco.auth;

import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtTokenVersionTest {
    private final JwtService jwt = new JwtService("test-jwt-secret-minimum-32-characters-long", 24);

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void tokenIssuedBeforeLogoutVersionIncrementIsRejected() throws Exception {
        User user = new User(); user.setId(42L); user.setEmail("user@example.com"); user.setRole(UserRole.CLIENT);
        user.setAuthTokenVersion(3);
        String token = jwt.issue(user);
        user.setAuthTokenVersion(4);

        UserRepository users = mock(UserRepository.class);
        when(users.findById(42L)).thenReturn(Optional.of(user));
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);

        filter.doFilterInternal(request, new MockHttpServletResponse(), mock(jakarta.servlet.FilterChain.class));

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void currentTokenVersionAuthenticates() throws Exception {
        User user = new User(); user.setId(43L); user.setEmail("user2@example.com"); user.setRole(UserRole.CLIENT);
        user.setAuthTokenVersion(7);
        UserRepository users = mock(UserRepository.class);
        when(users.findById(43L)).thenReturn(Optional.of(user));
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwt, users);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwt.issue(user));

        filter.doFilterInternal(request, new MockHttpServletResponse(), mock(jakarta.servlet.FilterChain.class));

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
