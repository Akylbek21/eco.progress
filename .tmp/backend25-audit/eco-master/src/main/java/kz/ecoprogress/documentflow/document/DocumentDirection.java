package kz.ecoprogress.documentflow.document;

/** Which way a document flows relative to the owning organization. INTERNAL documents have
 *  neither a real sender nor recipient organization (both nullable on {@link Document}). */
public enum DocumentDirection {
    INCOMING,
    OUTGOING,
    INTERNAL
}
