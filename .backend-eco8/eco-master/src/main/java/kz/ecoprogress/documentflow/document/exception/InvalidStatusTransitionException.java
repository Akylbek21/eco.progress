package kz.ecoprogress.documentflow.document.exception;

import kz.eco.common.exception.ConflictException;

public class InvalidStatusTransitionException extends ConflictException {
    public InvalidStatusTransitionException(String message) {
        super(message, "INVALID_STATUS_TRANSITION");
    }
}
