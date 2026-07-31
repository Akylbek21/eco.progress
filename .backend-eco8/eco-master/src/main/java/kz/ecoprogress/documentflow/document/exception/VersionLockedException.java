package kz.ecoprogress.documentflow.document.exception;

import kz.eco.common.exception.ConflictException;

public class VersionLockedException extends ConflictException {
    public VersionLockedException(String message) {
        super(message, "VERSION_LOCKED");
    }
}
