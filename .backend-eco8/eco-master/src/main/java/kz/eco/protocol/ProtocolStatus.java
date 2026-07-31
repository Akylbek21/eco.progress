package kz.eco.protocol;

import java.util.Map;
import java.util.Set;

public enum ProtocolStatus {
    DRAFT,
    CALCULATED,
    /** Legacy "simplified" pre-approval state, kept for backward compatibility with protocols
     *  created before READY_FOR_APPROVAL/NEEDS_REVISION existed - see ProtocolService.sign(). */
    READY,
    READY_FOR_APPROVAL,
    NEEDS_REVISION,
    APPROVED,
    SIGNED,
    REPLACED,
    CANCELLED,
    ARCHIVED;

    /** Canonical transition table (spec §3). READY is additionally wired wherever CALCULATED is,
     *  purely for backward compatibility with the pre-existing simplified flow - it is never a
     *  transition target for new protocols going through readyForApproval(). */
    private static final Map<ProtocolStatus, Set<ProtocolStatus>> ALLOWED_TRANSITIONS = Map.ofEntries(
            Map.entry(DRAFT, Set.of(CALCULATED, READY_FOR_APPROVAL, CANCELLED)),
            Map.entry(CALCULATED, Set.of(READY_FOR_APPROVAL, CANCELLED, DRAFT)),
            Map.entry(READY, Set.of(READY_FOR_APPROVAL, SIGNED, CANCELLED, DRAFT)),
            Map.entry(READY_FOR_APPROVAL, Set.of(NEEDS_REVISION, APPROVED, CANCELLED, DRAFT)),
            Map.entry(NEEDS_REVISION, Set.of(READY_FOR_APPROVAL, CANCELLED, DRAFT)),
            Map.entry(APPROVED, Set.of(SIGNED, DRAFT)),
            Map.entry(SIGNED, Set.of(REPLACED)),
            Map.entry(REPLACED, Set.of(ARCHIVED)),
            Map.entry(CANCELLED, Set.of(ARCHIVED)),
            Map.entry(ARCHIVED, Set.of())
    );

    /** Statuses whose content (header/company/object/lab/executor/results/normatives/devices/
     *  environment/files/number/date) may still be changed. Everything else is frozen. */
    private static final Set<ProtocolStatus> EDITABLE = Set.of(DRAFT, CALCULATED, READY, NEEDS_REVISION);

    public boolean canTransitionTo(ProtocolStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isEditable() {
        return EDITABLE.contains(this);
    }
}
