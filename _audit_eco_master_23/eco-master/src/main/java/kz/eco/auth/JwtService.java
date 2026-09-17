package kz.eco.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    /** Минимальная длина ключа для HS256 (RFC 7518: не короче размера выхода хэша). */
    private static final int MIN_SECRET_LENGTH = 32;

    public JwtService(
            @Value("${eco.security.jwt.secret}") String secret,
            @Value("${eco.security.jwt.ttl-hours:24}") long ttlHours
    ) {
        validateSecret(secret);
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(ttlHours);
    }

    /**
     * Fail-fast на старте: приложение не должно подниматься с пустым или заведомо слабым
     * JWT-секретом (раньше секрет был захардкожен в application.properties и попадал в репозиторий).
     * Dev-значение задаётся только в явном профиле {@code local}; docker/production обязаны
     * передать ECO_JWT_SECRET через окружение/secret storage.
     */
    static void validateSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "JWT secret не задан. Задайте переменную окружения ECO_JWT_SECRET (минимум "
                            + MIN_SECRET_LENGTH + " символов), например: openssl rand -base64 48");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                    "JWT secret слишком короткий: требуется минимум " + MIN_SECRET_LENGTH + " символов");
        }
        String normalized = secret.toLowerCase(java.util.Locale.ROOT);
        for (String weak : new String[]{"changeme", "change-me", "changeit", "default", "example", "placeholder"}) {
            if (normalized.contains(weak)) {
                throw new IllegalStateException("JWT secret выглядит как значение по умолчанию - задайте реальный ECO_JWT_SECRET");
            }
        }
    }

    public String issue(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + ttl.toMillis());
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("userId", user.getId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("tokenVersion", user.getAuthTokenVersion())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public Long extractUserId(String token) {
        Claims claims = parse(token);
        return Long.parseLong(claims.getSubject());
    }

    public UserRole extractRole(String token) {
        Claims claims = parse(token);
        return UserRole.valueOf(String.valueOf(claims.get("role")));
    }

    public long extractTokenVersion(String token) {
        Number value = parse(token).get("tokenVersion", Number.class);
        return value == null ? 0L : value.longValue();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
