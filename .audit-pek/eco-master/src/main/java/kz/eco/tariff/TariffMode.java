package kz.eco.tariff;

public enum TariffMode {
    ONE_TIME("Разовая задача"),
    MONTHLY("Ежемесячное сопровождение");

    private final String label;

    TariffMode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
