package kz.eco.services;

public enum ServiceCategory {
    PROJECTING("Проектирование"),
    PERMITS("Разрешения"),
    LABORATORY("Лаборатория"),
    WASTE("Отходы"),
    ENTERPRISE("Предприятия");

    private final String label;

    ServiceCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static ServiceCategory fromLabel(String label) {
        for (ServiceCategory c : values()) {
            if (c.label.equalsIgnoreCase(label)) return c;
        }
        throw new IllegalArgumentException("Неизвестная категория: " + label);
    }
}
