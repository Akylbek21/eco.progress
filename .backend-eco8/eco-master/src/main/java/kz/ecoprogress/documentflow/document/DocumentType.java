package kz.ecoprogress.documentflow.document;

/** The catalog of document types the "Документооборот" module understands. Metadata for each
 *  (allowed directions, required feature, mime/size limits, signing/counterparty requirements) is
 *  in {@link DocumentTypeRegistry}, mirroring how kz.eco.protocol.ProtocolTypeRegistry separates
 *  the bare enum from its configuration. */
public enum DocumentType {
    REALIZATION_OF_GOODS_SERVICES,
    RECEIPT_OF_GOODS_SERVICES,
    RETURN_TO_SUPPLIER,
    RETURN_FROM_CUSTOMER,
    RECONCILIATION_ACT,
    CONTRACT,
    ADDITIONAL_AGREEMENT,
    COMPLETION_ACT,
    SERVICE_ACT,
    INVOICE,
    COMMERCIAL_OFFER,
    LAB_PROTOCOL,
    SAMPLING_ACT,
    ENVIRONMENTAL_REPORT,
    PEC_REPORT,
    WASTE_PASSPORT,
    WASTE_TRANSFER_ACT,
    DISPOSAL_ACT,
    CUSTOM_DOCUMENT,
    REVOCATION_REQUEST
}
