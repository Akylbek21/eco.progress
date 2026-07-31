package kz.eco.order;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class OrderStatusConverter implements AttributeConverter<OrderStatus, String> {

    @Override
    public String convertToDatabaseColumn(OrderStatus status) {
        return status == null ? null : status.name();
    }

    @Override
    public OrderStatus convertToEntityAttribute(String dbValue) {
        if (dbValue == null || dbValue.isBlank()) return OrderStatus.CONSULTATION;
        try {
            return OrderStatus.valueOf(dbValue);
        } catch (IllegalArgumentException e) {
            return mapLegacy(dbValue);
        }
    }

    private OrderStatus mapLegacy(String old) {
        return switch (old.toUpperCase()) {
            case "NEW" -> OrderStatus.CONSULTATION;
            case "AWAITING_DOCUMENTS", "DOCUMENTS_REVIEW" -> OrderStatus.ANALYSIS;
            case "CONTRACT_AND_INVOICE" -> OrderStatus.COMMERCIAL_PROPOSAL;
            case "AWAITING_PAYMENT" -> OrderStatus.INVOICE;
            case "PAID", "APPROVAL", "REVISION" -> OrderStatus.QUALITY_CHECK;
            case "IN_WORK" -> OrderStatus.DESIGN;
            case "CONSULTATION" -> OrderStatus.CONSULTATION;
            case "ANALYSIS" -> OrderStatus.ANALYSIS;
            case "COMMERCIAL_PROPOSAL" -> OrderStatus.COMMERCIAL_PROPOSAL;
            case "CONTRACT" -> OrderStatus.CONTRACT;
            case "INVOICE" -> OrderStatus.INVOICE;
            case "DESIGN" -> OrderStatus.DESIGN;
            case "LABORATORY" -> OrderStatus.LABORATORY;
            case "WASTE_REMOVAL" -> OrderStatus.WASTE_REMOVAL;
            case "UTILIZATION" -> OrderStatus.UTILIZATION;
            case "QUALITY_CHECK" -> OrderStatus.QUALITY_CHECK;
            case "READY" -> OrderStatus.READY;
            default -> OrderStatus.CONSULTATION;
        };
    }
}
