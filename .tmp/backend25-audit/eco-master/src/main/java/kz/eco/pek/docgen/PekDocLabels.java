package kz.eco.pek.docgen;

import kz.eco.pek.PekExceedanceStatus;
import kz.eco.pek.PekMeasureStatus;
import kz.eco.pek.PekMonitoringType;
import kz.eco.pek.PekPeriodType;
import kz.eco.pek.PekReport;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/** Russian wording shared by the report-package documents, so the note, the measures report and
 *  the emissions table name a period, a component or a status the same way. */
final class PekDocLabels {

    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private PekDocLabels() {
    }

    /** "1 квартал 2026 года" / "2026 год". */
    static String period(PekReport report) {
        if (report.getPeriodType() == PekPeriodType.YEAR) {
            return report.getReportYear() + " год";
        }
        return report.getReportQuarter() + " квартал " + report.getReportYear() + " года";
    }

    static String date(LocalDate d) {
        return d == null ? null : d.format(DATE);
    }

    static String monitoringType(PekMonitoringType t) {
        if (t == null) return null;
        return switch (t) {
            case AMBIENT_AIR -> "Атмосферный воздух (СЗЗ)";
            case EMISSION_SOURCE -> "Выбросы в атмосферу";
            case SURFACE_WATER -> "Поверхностные воды";
            case GROUNDWATER -> "Подземные воды";
            case WASTEWATER -> "Сточные воды";
            case SOIL -> "Почва";
            case WASTE -> "Отходы";
            case PHYSICAL_FACTOR -> "Физические факторы";
        };
    }

    static String measureStatus(PekMeasureStatus s) {
        if (s == null) return null;
        return switch (s) {
            case PLANNED -> "Запланировано";
            case IN_PROGRESS -> "Выполняется";
            case COMPLETED -> "Выполнено";
            case OVERDUE -> "Просрочено";
            case CANCELLED -> "Отменено";
        };
    }

    static String exceedanceStatus(PekExceedanceStatus s) {
        if (s == null) return null;
        return switch (s.name()) {
            case "OPEN" -> "Открыто";
            case "UNDER_REVIEW" -> "На рассмотрении";
            case "CONFIRMED" -> "Подтверждено";
            case "FALSE_POSITIVE" -> "Не подтверждено";
            case "IN_PROGRESS" -> "Устраняется";
            case "RESOLVED" -> "Устранено";
            default -> s.name();
        };
    }

    /** Decimal as printed in a Word table: no trailing zeros, comma separator. */
    static String number(BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
