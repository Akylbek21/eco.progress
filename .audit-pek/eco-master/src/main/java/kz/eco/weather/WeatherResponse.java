package kz.eco.weather;

import java.math.BigDecimal;

/**
 * Module spec §11: {@code available}/{@code latitude}/{@code longitude}/{@code message} are
 * additive - the original date/time/city/temperatureC/humidityPercent/pressureKpa/windSpeedMs/
 * source fields are kept exactly as-is (not renamed to the spec's temperature/humidity/windSpeed
 * names) since existing frontend callers already read this shape; renaming would just create a
 * second competing contract instead of fixing the actual bug (fixed Shymkent coordinates).
 */
public record WeatherResponse(
        String date,
        String time,
        String city,
        BigDecimal temperatureC,
        Integer humidityPercent,
        BigDecimal pressureKpa,
        BigDecimal windSpeedMs,
        String source,
        boolean available,
        BigDecimal latitude,
        BigDecimal longitude,
        String message
) {
}
