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

    public JwtService(
            @Value("${eco.security.jwt.secret}") String secret,
            @Value("${eco.security.jwt.ttl-hours:24}") long ttlHours
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofHours(ttlHours);
    }

    public String issue(User user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + ttl.toMillis());
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("userId", user.getId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
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

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
