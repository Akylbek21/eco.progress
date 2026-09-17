package kz.eco.pek;

public enum PekSettingsReportType {
    QUARTERLY,
    YEARLY;

    public PekPeriodType toPeriodType() {
        return this == QUARTERLY ? PekPeriodType.QUARTER : PekPeriodType.YEAR;
    }
}
