package kz.eco.protocol;

import kz.eco.common.ApiFieldError;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Single source of truth for the hard blockers that must stop a protocol from leaving DRAFT
 * (readyForApproval), being approved, or being signed - used identically by all three call sites
 * (ProtocolService.validateReadyForApproval / validateBeforeApprove / validateBeforeSign, the
 * latter two of which call through validateReadyForApproval, so this list is checked at every
 * transition, not just the first one a protocol happens to pass through).
 *
 * <p>Previously readyForApproval only blocked on NORMATIVE_NOT_SELECTED/NORMATIVE_INACTIVE - a
 * row whose normative search came back NORMATIVE_NOT_FOUND, whose unit didn't match the resolved
 * normative (UNIT_MISMATCH), or that had no comparable result value at all (EMPTY_RESULT) could
 * still reach READY_FOR_APPROVAL/APPROVED/SIGNED. All five statuses are now uniformly blocking.
 */
@Service
public class ProtocolReleaseValidationService {

    /** The five hard-blocker internal statuses - a result row in any of these states can never
     *  reach a released (READY_FOR_APPROVAL and beyond) protocol. */
    public static final Set<ResultInternalStatus> HARD_BLOCKER_STATUSES = EnumSet.of(
            ResultInternalStatus.NORMATIVE_NOT_SELECTED,
            ResultInternalStatus.NORMATIVE_NOT_FOUND,
            ResultInternalStatus.NORMATIVE_INACTIVE,
            ResultInternalStatus.UNIT_MISMATCH,
            ResultInternalStatus.EMPTY_RESULT
    );

    /** Field-error form (module spec item 8's readyForApproval-style aggregated response) - used
     *  by validateReadyForApproval so the client sees every offending row in one response. */
    public List<ApiFieldError> collectFieldErrors(List<ProtocolResult> results) {
        List<ApiFieldError> errors = new ArrayList<>();
        for (ProtocolResult r : results) {
            ResultInternalStatus status = r.getInternalStatus();
            if (status == null || !HARD_BLOCKER_STATUSES.contains(status)) {
                continue;
            }
            String prefix = "results[" + r.getRowNumber() + "]";
            String name = safeIndicatorName(r);
            errors.add(new ApiFieldError(prefix + ".normativeId", status.name(),
                    "Строка \"" + name + "\": " + describe(status)));
        }
        return errors;
    }

    /** Fail-fast form (module spec item 3's sign-time re-check) - throws on the first offending
     *  row, mirroring validateBeforeSign's pre-existing fail-fast style for this check. */
    public void requireNoHardBlockers(List<ProtocolResult> results) {
        for (ProtocolResult r : results) {
            ResultInternalStatus status = r.getInternalStatus();
            if (status != null && HARD_BLOCKER_STATUSES.contains(status)) {
                throw new kz.eco.common.exception.ConflictException(
                        "Строка \"" + safeIndicatorName(r) + "\": " + describe(status), status.name());
            }
        }
    }

    private static String describe(ResultInternalStatus status) {
        return switch (status) {
            case NORMATIVE_NOT_SELECTED -> "норматив не выбран";
            case NORMATIVE_NOT_FOUND -> "норматив не найден";
            case NORMATIVE_INACTIVE -> "норматив неактивен";
            case UNIT_MISMATCH -> "единица измерения не совпадает с нормативом";
            case EMPTY_RESULT -> "нет значения результата";
            default -> status.name();
        };
    }

    private static String safeIndicatorName(ProtocolResult r) {
        return r.getIndicatorName() != null && !r.getIndicatorName().isBlank()
                ? r.getIndicatorName() : "строка " + r.getRowNumber();
    }
}
