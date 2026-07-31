package kz.eco.common.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public final class RuDateFormatter {

    private static final Locale RU = Locale.forLanguageTag("ru-RU");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", RU);
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("d MMMM yyyy, HH:mm", RU);

    private RuDateFormatter() {
    }

    public static String formatDate(LocalDateTime value) {
        return value == null ? null : value.format(DATE);
    }

    public static String formatDateTime(LocalDateTime value) {
        return value == null ? null : value.format(DATETIME);
    }
}
