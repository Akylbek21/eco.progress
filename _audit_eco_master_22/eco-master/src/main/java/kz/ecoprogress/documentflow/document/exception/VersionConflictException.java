package kz.ecoprogress.documentflow.document.exception;

import kz.eco.common.exception.ConflictException;

/** Thrown on a stale @Version mismatch caught early in the service layer (before the DB
 *  round-trip would surface it as ObjectOptimisticLockingFailureException). */
public class VersionConflictException extends ConflictException {
    public VersionConflictException(String message) {
        super(message, "VERSION_CONFLICT");
    }
}
