package kz.ecoprogress.documentflow.document;

import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Single source of truth for what each {@link DocumentType} means: allowed directions, whether it
 * needs an extra plan feature beyond base DOCUMENT_FLOW/DOCUMENT_CREATE, accepted file types/size,
 * and whether signing/a counterparty are mandatory. Mirrors the separation of concerns in
 * kz.eco.protocol.ProtocolTypeRegistry (bare enum vs. static config registry) rather than a
 * runtime-configurable DB table - none of these fields need to change without a code deploy.
 */
public final class DocumentTypeRegistry {

    private static final List<String> DEFAULT_MIME_TYPES = List.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/png",
            "image/jpeg"
    );

    private static final long DEFAULT_MAX_SIZE_BYTES = 25L * 1024 * 1024; // 25 MB

    private static final Map<DocumentType, DocumentTypeConfig> BY_TYPE = build();

    private DocumentTypeRegistry() {
    }

    private static Map<DocumentType, DocumentTypeConfig> build() {
        Map<DocumentType, DocumentTypeConfig> map = new EnumMap<>(DocumentType.class);

        map.put(DocumentType.REALIZATION_OF_GOODS_SERVICES, config(DocumentType.REALIZATION_OF_GOODS_SERVICES,
                "Реализация товаров/услуг", AllowedDirection.OUT, null, true, true));
        map.put(DocumentType.RECEIPT_OF_GOODS_SERVICES, config(DocumentType.RECEIPT_OF_GOODS_SERVICES,
                "Поступление товаров/услуг", AllowedDirection.IN, null, true, true));
        map.put(DocumentType.RETURN_TO_SUPPLIER, config(DocumentType.RETURN_TO_SUPPLIER,
                "Возврат поставщику", AllowedDirection.OUT, null, true, true));
        map.put(DocumentType.RETURN_FROM_CUSTOMER, config(DocumentType.RETURN_FROM_CUSTOMER,
                "Возврат от покупателя", AllowedDirection.IN, null, true, true));
        map.put(DocumentType.RECONCILIATION_ACT, config(DocumentType.RECONCILIATION_ACT,
                "Акт сверки", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.CONTRACT, config(DocumentType.CONTRACT,
                "Договор", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.ADDITIONAL_AGREEMENT, config(DocumentType.ADDITIONAL_AGREEMENT,
                "Дополнительное соглашение", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.COMPLETION_ACT, config(DocumentType.COMPLETION_ACT,
                "Акт выполненных работ", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.SERVICE_ACT, config(DocumentType.SERVICE_ACT,
                "Акт оказанных услуг", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.INVOICE, config(DocumentType.INVOICE,
                "Счет на оплату", AllowedDirection.OUT, null, true, true));
        map.put(DocumentType.COMMERCIAL_OFFER, config(DocumentType.COMMERCIAL_OFFER,
                "Коммерческое предложение", AllowedDirection.OUT, null, false, false));
        map.put(DocumentType.LAB_PROTOCOL, config(DocumentType.LAB_PROTOCOL,
                "Протокол лабораторных испытаний", AllowedDirection.OUT, null, true, false));
        map.put(DocumentType.SAMPLING_ACT, config(DocumentType.SAMPLING_ACT,
                "Акт отбора проб", AllowedDirection.BOTH, null, true, false));
        map.put(DocumentType.ENVIRONMENTAL_REPORT, config(DocumentType.ENVIRONMENTAL_REPORT,
                "Экологический отчет", AllowedDirection.OUT, null, true, false));
        map.put(DocumentType.PEC_REPORT, config(DocumentType.PEC_REPORT,
                "Отчет ПЭК", AllowedDirection.OUT, null, true, false));
        map.put(DocumentType.WASTE_PASSPORT, config(DocumentType.WASTE_PASSPORT,
                "Паспорт отхода", AllowedDirection.BOTH, null, true, false));
        map.put(DocumentType.WASTE_TRANSFER_ACT, config(DocumentType.WASTE_TRANSFER_ACT,
                "Акт передачи отходов", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.DISPOSAL_ACT, config(DocumentType.DISPOSAL_ACT,
                "Акт утилизации/уничтожения", AllowedDirection.BOTH, null, true, true));
        map.put(DocumentType.CUSTOM_DOCUMENT, config(DocumentType.CUSTOM_DOCUMENT,
                "Произвольный документ", AllowedDirection.BOTH, FeatureCode.DOCUMENT_TEMPLATES, false, false));
        map.put(DocumentType.REVOCATION_REQUEST, config(DocumentType.REVOCATION_REQUEST,
                "Запрос на отзыв документа", AllowedDirection.BOTH, null, false, false));

        return Map.copyOf(map);
    }

    private static DocumentTypeConfig config(DocumentType type, String title, AllowedDirection allowedDirection,
                                              FeatureCode requiredFeature, boolean signingRequired,
                                              boolean counterpartyRequired) {
        return new DocumentTypeConfig(type, title, allowedDirection, requiredFeature,
                DEFAULT_MIME_TYPES, DEFAULT_MAX_SIZE_BYTES, signingRequired, counterpartyRequired, true);
    }

    public static Optional<DocumentTypeConfig> find(DocumentType type) {
        return Optional.ofNullable(BY_TYPE.get(type));
    }

    public static DocumentTypeConfig require(DocumentType type) {
        return find(type).orElseThrow(() ->
                new IllegalArgumentException("Неизвестный тип документа: " + type));
    }

    public static List<DocumentTypeConfig> findActive() {
        return BY_TYPE.values().stream().filter(DocumentTypeConfig::active).toList();
    }

    public static Map<DocumentType, DocumentTypeConfig> all() {
        return BY_TYPE;
    }
}
