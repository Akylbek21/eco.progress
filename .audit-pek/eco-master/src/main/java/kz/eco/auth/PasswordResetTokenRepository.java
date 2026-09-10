package kz.eco.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    Optional<PasswordResetToken> findFirstByUserIdAndPurposeAndStatusOrderByCreatedAtDesc(
            Long userId, PasswordResetTokenPurpose purpose, PasswordResetTokenStatus status);
}
