package kz.eco.pek;

import org.junit.jupiter.api.Test;

import java.util.EnumSet;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pure unit coverage of the state machine (module spec §15) - no Spring context needed. */
class PekProgramStatusTest {

    @Test
    void draft_canOnlyGoToUnderReviewOrArchived() {
        assertTrue(PekProgramStatus.DRAFT.canTransitionTo(PekProgramStatus.UNDER_REVIEW));
        assertTrue(PekProgramStatus.DRAFT.canTransitionTo(PekProgramStatus.ARCHIVED));
        assertFalse(PekProgramStatus.DRAFT.canTransitionTo(PekProgramStatus.ACTIVE));
        assertFalse(PekProgramStatus.DRAFT.canTransitionTo(PekProgramStatus.APPROVED));
        assertFalse(PekProgramStatus.DRAFT.canTransitionTo(PekProgramStatus.RETURNED));
    }

    @Test
    void underReview_canGoToReturnedOrApproved_notDirectlyToActive() {
        assertTrue(PekProgramStatus.UNDER_REVIEW.canTransitionTo(PekProgramStatus.RETURNED));
        assertTrue(PekProgramStatus.UNDER_REVIEW.canTransitionTo(PekProgramStatus.APPROVED));
        assertFalse(PekProgramStatus.UNDER_REVIEW.canTransitionTo(PekProgramStatus.ACTIVE));
        assertFalse(PekProgramStatus.UNDER_REVIEW.canTransitionTo(PekProgramStatus.ARCHIVED));
    }

    @Test
    void returned_canOnlyGoBackToUnderReview() {
        assertTrue(PekProgramStatus.RETURNED.canTransitionTo(PekProgramStatus.UNDER_REVIEW));
        assertFalse(PekProgramStatus.RETURNED.canTransitionTo(PekProgramStatus.APPROVED));
        assertFalse(PekProgramStatus.RETURNED.canTransitionTo(PekProgramStatus.ACTIVE));
        assertFalse(PekProgramStatus.RETURNED.canTransitionTo(PekProgramStatus.ARCHIVED));
    }

    @Test
    void approved_canOnlyActivate() {
        assertTrue(PekProgramStatus.APPROVED.canTransitionTo(PekProgramStatus.ACTIVE));
        assertFalse(PekProgramStatus.APPROVED.canTransitionTo(PekProgramStatus.ARCHIVED));
        assertFalse(PekProgramStatus.APPROVED.canTransitionTo(PekProgramStatus.DRAFT));
    }

    @Test
    void active_canOnlyArchive() {
        assertTrue(PekProgramStatus.ACTIVE.canTransitionTo(PekProgramStatus.ARCHIVED));
        assertFalse(PekProgramStatus.ACTIVE.canTransitionTo(PekProgramStatus.APPROVED));
    }

    @Test
    void archived_isTerminal() {
        for (PekProgramStatus target : PekProgramStatus.values()) {
            assertFalse(PekProgramStatus.ARCHIVED.canTransitionTo(target));
        }
    }

    @Test
    void isEditable_onlyForDraftAndReturned() {
        assertTrue(PekProgramStatus.DRAFT.isEditable());
        assertTrue(PekProgramStatus.RETURNED.isEditable());
        for (PekProgramStatus status : EnumSet.of(PekProgramStatus.UNDER_REVIEW, PekProgramStatus.APPROVED,
                PekProgramStatus.ACTIVE, PekProgramStatus.ARCHIVED)) {
            assertFalse(status.isEditable(), status + " must not be editable");
        }
    }
}
