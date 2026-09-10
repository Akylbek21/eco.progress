package kz.ecoprogress.documentflow.subscription;

import java.util.EnumSet;
import java.util.Set;

public enum SubscriptionStatus {
    PENDING,
    TRIAL,
    ACTIVE,
    GRACE_PERIOD,
    SUSPENDED,
    EXPIRED,
    CANCELLED;

    /** The "at most one per organization" set enforced at the service level in SubscriptionService. */
    private static final Set<SubscriptionStatus> NON_TERMINAL = EnumSet.of(PENDING, TRIAL, ACTIVE, GRACE_PERIOD, SUSPENDED);

    public boolean isNonTerminal() {
        return NON_TERMINAL.contains(this);
    }

    public static Set<SubscriptionStatus> nonTerminalStatuses() {
        return NON_TERMINAL;
    }
}
