package kz.eco.auth;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.user.User;
import kz.eco.user.UserAuditAction;
import kz.eco.user.UserRepository;
import kz.eco.user.UserStatus;
import kz.ecoprogress.documentflow.signing.Sha256Util;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** One-time password setup/reset tokens for kz.eco.user.User - mirrors
 *  kz.ecoprogress.documentflow.membership.MembershipInvitationService's hash+TTL+single-use shape. */
@Service
public class PasswordResetTokenService {

    public record Created(PasswordResetToken token, String rawToken) {}

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public PasswordResetTokenService(PasswordResetTokenRepository tokenRepository,
                                      UserRepository userRepository,
                                      PasswordEncoder passwordEncoder,
                                      AuditLogService auditLogService) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public Created create(User user, PasswordResetTokenPurpose purpose) {
        tokenRepository.findFirstByUserIdAndPurposeAndStatusOrderByCreatedAtDesc(
                        user.getId(), purpose, PasswordResetTokenStatus.PENDING)
                .ifPresent(old -> {
                    old.setStatus(PasswordResetTokenStatus.REVOKED);
                    tokenRepository.save(old);
                });

        String rawToken = Sha256Util.generateToken();
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(Sha256Util.sha256Hex(rawToken));
        token.setPurpose(purpose);
        token.setStatus(PasswordResetTokenStatus.PENDING);
        token.setExpiresAt(LocalDateTime.now().plus(purpose == PasswordResetTokenPurpose.SETUP
                ? java.time.Duration.ofDays(3) : java.time.Duration.ofHours(1)));
        return new Created(tokenRepository.save(token), rawToken);
    }

    @Transactional
    public Long consume(String rawToken, PasswordResetTokenPurpose expectedPurpose, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new BadRequestException("Пароль должен содержать не менее 8 символов", "PASSWORD_TOO_SHORT");
        }
        PasswordResetToken token = tokenRepository.findByTokenHash(Sha256Util.sha256Hex(rawToken))
                .orElseThrow(() -> new NotFoundException("Ссылка недействительна", invalidCode(expectedPurpose)));

        if (token.getPurpose() != expectedPurpose) {
            throw new NotFoundException("Ссылка недействительна", invalidCode(expectedPurpose));
        }
        if (token.getStatus() != PasswordResetTokenStatus.PENDING || token.getExpiresAt().isBefore(LocalDateTime.now())) {
            boolean actuallyExpired = token.getExpiresAt().isBefore(LocalDateTime.now());
            if (token.getStatus() == PasswordResetTokenStatus.PENDING) {
                token.setStatus(PasswordResetTokenStatus.EXPIRED);
                tokenRepository.save(token);
            }
            // A token that was already USED/REVOKED is "invalid", not "expired" - the client shows a
            // different message ("link already used" vs "request a new link"), so keep them distinct.
            if (actuallyExpired) {
                throw new BadRequestException("Срок действия ссылки истёк", expiredCode(expectedPurpose));
            }
            throw new BadRequestException("Ссылка уже использована или отозвана", invalidCode(expectedPurpose));
        }

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new NotFoundException("Пользователь не найден", "USER_NOT_FOUND"));
        UserStatus statusBefore = user.getStatus();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        if (expectedPurpose == PasswordResetTokenPurpose.SETUP && user.getStatus() == UserStatus.pending_setup) {
            user.setStatus(UserStatus.active);
        }
        user.setAuthTokenVersion(user.getAuthTokenVersion() + 1);
        userRepository.saveAndFlush(user);

        token.setStatus(PasswordResetTokenStatus.USED);
        token.setUsedAt(LocalDateTime.now());
        tokenRepository.save(token);

        if (expectedPurpose == PasswordResetTokenPurpose.SETUP) {
            // Actor is the invitee themselves - they are not authenticated yet, so pass the user we
            // just resolved from the token rather than CurrentUser.
            auditLogService.log(UserAuditAction.ENTITY_TYPE, user.getId(), null, user,
                    UserAuditAction.PASSWORD_SETUP_COMPLETED,
                    statusBefore.name(), user.getStatus().name(),
                    "Пароль установлен по одноразовой ссылке");
        }

        return user.getId();
    }

    /** Setup and reset links are different user-facing flows, so they get distinct stable error
     *  codes; the RESET codes keep their historical values for existing clients. */
    private static String invalidCode(PasswordResetTokenPurpose purpose) {
        return purpose == PasswordResetTokenPurpose.SETUP
                ? "SETUP_TOKEN_INVALID" : "PASSWORD_TOKEN_NOT_FOUND";
    }

    private static String expiredCode(PasswordResetTokenPurpose purpose) {
        return purpose == PasswordResetTokenPurpose.SETUP
                ? "SETUP_TOKEN_EXPIRED" : "PASSWORD_TOKEN_EXPIRED";
    }
}
