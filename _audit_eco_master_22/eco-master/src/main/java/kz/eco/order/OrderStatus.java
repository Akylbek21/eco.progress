package kz.eco.order;

public enum OrderStatus {
    CONSULTATION("Консультация"),
    ANALYSIS("Анализ"),
    COMMERCIAL_PROPOSAL("КП"),
    CONTRACT("Договор"),
    INVOICE("Счет на оплату"),
    DESIGN("Проектирование"),
    LABORATORY("Лаборатория"),
    WASTE_REMOVAL("Вывоз"),
    UTILIZATION("Утилизация"),
    QUALITY_CHECK("Проверка результата"),
    READY("Готово"),
    COMPLETED("Завершено"),
    CANCELLED("Отменено"),
    ANNUAL_ACTIVE("annual_active");

    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static OrderStatus fromLabel(String label) {
        if (label == null) throw new IllegalArgumentException("Неизвестный статус: null");
        for (OrderStatus s : values()) {
            if (s.label.equalsIgnoreCase(label)) return s;
        }
        return switch (label) {
            case "На консультации" -> CONSULTATION;
            case "Ожидаем документы" -> ANALYSIS;
            case "Документы на проверке" -> ANALYSIS;
            case "Договор и счет" -> COMMERCIAL_PROPOSAL;
            case "Ожидаем оплату" -> INVOICE;
            case "Оплачено" -> QUALITY_CHECK;
            case "В работе" -> DESIGN;
            case "На согласовании" -> QUALITY_CHECK;
            case "На исправлении" -> QUALITY_CHECK;
            default -> throw new IllegalArgumentException("Неизвестный статус: " + label);
        };
    }

    public static OrderStatus normalize(String raw) {
        if (raw == null) return CONSULTATION;
        return switch (raw.toLowerCase()) {
            case "consultation" -> CONSULTATION;
            case "analysis" -> ANALYSIS;
            case "commercial_proposal" -> COMMERCIAL_PROPOSAL;
            case "contract" -> CONTRACT;
            case "invoice" -> INVOICE;
            case "design" -> DESIGN;
            case "laboratory" -> LABORATORY;
            case "waste_removal" -> WASTE_REMOVAL;
            case "utilization" -> UTILIZATION;
            case "quality_check" -> QUALITY_CHECK;
            case "ready" -> READY;
            case "completed" -> COMPLETED;
            case "cancelled" -> CANCELLED;
            case "annual_active" -> ANNUAL_ACTIVE;

            // compatibility for simplified statuses
            case "new", "новая заявка" -> CONSULTATION;
            case "на консультации" -> CONSULTATION;
            case "ожидаем документы", "документы на проверке" -> ANALYSIS;
            case "договор и счет" -> COMMERCIAL_PROPOSAL;
            case "ожидаем оплату" -> INVOICE;
            case "оплачено" -> QUALITY_CHECK;
            case "в работе" -> DESIGN;
            case "на согласовании", "на исправлении" -> QUALITY_CHECK;
            case "готово" -> READY;
            case "завершено" -> COMPLETED;
            case "отменено" -> CANCELLED;

            default -> {
                try { yield valueOf(raw); }
                catch (IllegalArgumentException e) { yield fromLabel(raw); }
            }
        };
    }
}
