package kz.ecoprogress.documentflow.document.exception;

import kz.eco.common.exception.ConflictException;

public class DocumentNotEditableException extends ConflictException {
    public DocumentNotEditableException(String message) {
        super(message, "DOCUMENT_NOT_EDITABLE");
    }
}
