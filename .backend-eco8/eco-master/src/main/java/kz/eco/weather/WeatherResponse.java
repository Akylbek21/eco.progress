package kz.eco.weather;

import java.math.BigDecimal;

public record WeatherResponse(
        String date,
        String time,
        String city,
        BigDecimal temperatureC,
        Integer humidityPercent,
        BigDecimal pressureKpa,
        BigDecimal windSpeedMs,
        String source
) {
}
