package kz.eco.protocol.docgen;

import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolEnvironmentConditions;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultValuesMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * Shared value-resolution and formatting rules for protocol document generation.
 * Every value that ends up in a rendered document goes through here so a missing
 * field always renders as "—" instead of "null"/"undefined"/"NaN" or a raw "a".
 */
final class ProtocolDocValues {

    static final String EMPTY = "—"; // —

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private ProtocolDocValues() {
    }

    static String safe(String value) {
        if (value == null) {
            return EMPTY;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? EMPTY : trimmed;
    }

    static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return EMPTY;
    }

    static String formatDate(LocalDate date) {
        return date != null ? date.format(DATE_FMT) : EMPTY;
    }

    static String firstNonBlankDate(LocalDate... dates) {
        for (LocalDate date : dates) {
            if (date != null) {
                return formatDate(date);
            }
        }
        return EMPTY;
    }

    static String formatDatePair(LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return EMPTY;
        }
        if (from == null) {
            return formatDate(to);
        }
        if (to == null || to.equals(from)) {
            return formatDate(from);
        }
        return formatDate(from) + " - " + formatDate(to);
    }

    static String formatDecimal(BigDecimal value) {
        if (value == null) {
            return EMPTY;
        }
        return value.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    /**
     * Norm ("норма по НД" / "нормативы (ПДК)") resolution priority, per spec:
     * maxOneTimeValue -> dailyAverageValue -> obuvValue -> normativeValue -> min-max range.
     */
    static String resolveNorm(ProtocolResult result, Map<String, Object> values) {
        String maxOneTime = stringValue(values.get("maxOneTimeValue"));
        if (maxOneTime != null) {
            return maxOneTime;
        }
        String dailyAverage = stringValue(values.get("dailyAverageValue"));
        if (dailyAverage != null) {
            return dailyAverage;
        }
        String obuv = stringValue(values.get("obuvValue"));
        if (obuv != null) {
            return obuv;
        }
        if (result.getNormativeValue() != null) {
            return formatDecimal(result.getNormativeValue());
        }
        if (result.getMinValue() != null && result.getMaxValue() != null) {
            return formatDecimal(result.getMinValue()) + "-" + formatDecimal(result.getMaxValue());
        }
        if (result.getMaxValue() != null) {
            return formatDecimal(result.getMaxValue());
        }
        return EMPTY;
    }

    /** Actual measurement value for the "Результаты испытаний" column. */
    static String resolveResult(ProtocolResult result) {
        BigDecimal value = firstNonNull(result.getResultValue(), result.getResultMgM3(),
                result.getResultMgDm3(), result.getCoPercent());
        return value != null ? formatDecimal(value) : EMPTY;
    }

    /**
     * НД на методы испытаний: a row-level НД always wins; the protocol's general НД
     * (filled once for the whole protocol) is only used when the row itself has none.
     * Priority: result.testingMethodNd -> values.testingMethodDocument -> values.testingMethod
     * -> protocol.testingMethodNd (= testing.testingMethodDocument in the API) ->
     * protocol.testingMethodDocument (legacy field) -> "—".
     */
    static String resolveTestingMethod(ProtocolResult result, Map<String, Object> values, Protocol protocol) {
        String rowMethod = firstNonBlankOrNull(
                result.getTestingMethodNd(),
                stringValue(values.get("testingMethodDocument")),
                stringValue(values.get("testingMethod")));
        if (rowMethod != null) {
            return rowMethod;
        }
        if (protocol == null) {
            return EMPTY;
        }
        String protocolMethod = firstNonBlankOrNull(
                protocol.getTestingMethodNd(),
                protocol.getTestingMethodDocument());
        return protocolMethod != null ? protocolMethod : EMPTY;
    }

    private static String firstNonBlankOrNull(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    static String resolveIndicatorWithUnit(ProtocolResult result) {
        String indicator = result.getIndicatorName();
        String unit = result.getUnit();
        if (indicator == null || indicator.isBlank()) {
            return EMPTY;
        }
        if (unit == null || unit.isBlank()) {
            return indicator.trim();
        }
        return indicator.trim() + ", " + unit.trim();
    }

    static Map<String, Object> valuesOf(ProtocolResult result) {
        return ProtocolResultValuesMapper.readValuesMap(result);
    }

    static String buildEnvironmentConditions(ProtocolEnvironmentConditions env, String fallback) {
        return buildEnvironmentConditions(env, fallback, true, true, true, true);
    }

    /** Per-component visibility variant: a hidden sub-component (temperature/humidity/pressure/
     * windSpeed) is left out of the composite string even though its value is still on the
     * entity - the fallback comment/legacy text is only used when nothing else got rendered. */
    static String buildEnvironmentConditions(ProtocolEnvironmentConditions env, String fallback,
                                              boolean temperatureVisible, boolean humidityVisible,
                                              boolean pressureVisible, boolean windSpeedVisible) {
        if (env != null) {
            StringBuilder sb = new StringBuilder();
            if (temperatureVisible && env.getTemperatureC() != null) {
                sb.append("температура – ").append(formatDecimal(env.getTemperatureC())).append(" °C");
            }
            if (humidityVisible && env.getHumidityPercent() != null) {
                if (!sb.isEmpty()) sb.append(", ");
                sb.append("влажность – ")
                        .append(formatDecimal(env.getHumidityPercent().setScale(0, RoundingMode.HALF_UP)))
                        .append(" %");
            }
            if (pressureVisible && env.getPressureKpa() != null) {
                if (!sb.isEmpty()) sb.append(", ");
                sb.append("давление – ").append(formatDecimal(env.getPressureKpa())).append(" кПа");
            }
            if (windSpeedVisible && env.getWindSpeedMs() != null) {
                if (!sb.isEmpty()) sb.append(", ");
                sb.append("скорость ветра – ").append(formatDecimal(env.getWindSpeedMs())).append(" м/с");
            }
            if (!sb.isEmpty()) {
                return sb.toString();
            }
            if (env.getConditionsComment() != null && !env.getConditionsComment().isBlank()) {
                return env.getConditionsComment().trim();
            }
        }
        return fallback != null && !fallback.isBlank() ? fallback.trim() : EMPTY;
    }

    private static String stringValue(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        return text.isEmpty() ? null : text;
    }

    private static BigDecimal firstNonNull(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
