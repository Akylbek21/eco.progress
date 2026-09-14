package kz.eco.user;

public enum UserStatus {
    active,
    blocked,
    deleted,
    /** Created by an admin without a password - the user must set one via the emailed
     *  setup-password link before they can log in (see kz.eco.auth.PasswordResetTokenService). */
    pending_setup
}
