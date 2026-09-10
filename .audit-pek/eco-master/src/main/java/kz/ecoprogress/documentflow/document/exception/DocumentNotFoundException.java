package kz.ecoprogress.documentflow.document.exception;

import kz.eco.common.exception.NotFoundException;

public class DocumentNotFoundException extends NotFoundException {
    public DocumentNotFoundException(String message) {
        super(message, "DOCUMENT_NOT_FOUND");
    }
}
