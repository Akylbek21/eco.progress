package kz.eco.protocol;

/** Thrown when a signed/immutable protocol's stored PDF or DOCX file is unexpectedly missing at
 *  download time (module spec §6.8) - the correct response is a hard integrity error, never a
 *  silent on-demand re-render, since that would serve content that was never actually signed. */
public class SignedDocumentIntegrityException extends RuntimeException {

    public SignedDocumentIntegrityException(String message) {
        super(message);
    }
}
