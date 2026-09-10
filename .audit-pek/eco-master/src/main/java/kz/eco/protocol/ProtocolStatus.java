package kz.eco.protocol;

import java.util.Map;
import java.util.Set;

/**
 * P1 module fix item 5: single canonical lifecycle - READY (a legacy simplified-flow status that
 * used to let a lab executor sign straight from CALCULATED, bypassing formal review) has been
 * fully retired: removed from this enum, migrated out of the database (V97 migration:
 * READY -&gt; READY_FOR_APPROVAL for any pre-existing rows), and removed from every permission/
 * transition/mutation-guard/filter rule and test that referenced it. There is exactly one path
 * from DRAFT to SIGNED now, with no parallel shortcut.
 */
public enum ProtocolStatus {
    DRAFT,
    CALCULATED,
    READY_FOR_APPROVAL,
    NEEDS_REVISION,
    APPROVED,
    SIGNED,
    REPLACED,
    CANCELLED,
    ARCHIVED;

    /** Canonical transition table (spec §3). */
    private static final Map<ProtocolStatus, Set<ProtocolStatus>> ALLOWED_TRANSITIONS = Map.ofEntries(
            Map.entry(DRAFT, Set.of(CALCULATED, READY_FOR_APPROVAL, CANCELLED)),
            Map.entry(CALCULATED, Set.of(READY_FOR_APPROVAL, CANCELLED, DRAFT)),
            Map.entry(READY_FOR_APPROVAL, Set.of(NEEDS_REVISION, APPROVED, CANCELLED, DRAFT)),
            Map.entry(NEEDS_REVISION, Set.of(READY_FOR_APPROVAL, CANCELLED, DRAFT)),
            Map.entry(APPROVED, Set.of(SIGNED, DRAFT)),
            Map.entry(SIGNED, Set.of(REPLACED)),
            Map.entry(REPLACED, Set.of(ARCHIVED)),
            Map.entry(CANCELLED, Set.of(ARCHIVED)),
            Map.entry(ARCHIVED, Set.of())
    );

    /** Statuses whose content (header/company/object/lab/executor/results/normatives/devices/
     *  environment/files/number/date) may still be changed. Everything else is frozen. Also the
     *  gate for generate/regenerate DOCX/PDF (module fix item 7): APPROVED is deliberately NOT
     *  editable, so a user can never regenerate (and so silently replace) the exact PDF that was
     *  approved - the only way to change an APPROVED protocol's documents is returnToDraft() first. */
    private static final Set<ProtocolStatus> EDITABLE = Set.of(DRAFT, CALCULATED, NEEDS_REVISION);

    /** Statuses in which document generation must never run again - see
     *  ProtocolMutationGuard.GENERATION_BLOCKED, which this backs (single source of truth so
     *  ProtocolPermissionService's canGenerateDocuments/canRegenerateDocuments can't drift from
     *  what the guard actually enforces). */
    private static final Set<ProtocolStatus> GENERATION_BLOCKED = Set.of(SIGNED, REPLACED, CANCELLED, ARCHIVED);

    public boolean canTransitionTo(ProtocolStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isEditable() {
        return EDITABLE.contains(this);
    }

    public boolean isGenerationBlocked() {
        return GENERATION_BLOCKED.contains(this);
    }
}
