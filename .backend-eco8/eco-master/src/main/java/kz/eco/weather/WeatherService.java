package kz.eco.weather;

import kz.eco.common.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    private static final double LATITUDE = 42.3155;
    private static final double LONGITUDE = 69.5869;
    private static final String TIMEZONE = "Asia/Almaty";
    private static final String BASE_URL = "https://archive-api.open-meteo.com/v1/archive";

    private final RestClient restClient = RestClient.create();

    public WeatherResponse getWeather(String dateStr, Long objectId, String time) {
        if (dateStr == null || dateStr.isBlank()) {
            throw new BadRequestException("Параметр date обязателен");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(dateStr);
        } catch (Exception e) {
            throw new BadRequestException("Некорректный формат даты: " + dateStr);
        }
        if (date.isAfter(LocalDate.now())) {
            throw new BadRequestException("Нельзя запрашивать погоду на будущую дату");
        }

        String effectiveTime = time != null && !time.isBlank() ? time.trim() : "12:00";

        try {
            String url = BASE_URL + "?latitude=" + LATITUDE
                    + "&longitude=" + LONGITUDE
                    + "&start_date=" + dateStr
                    + "&end_date=" + dateStr
                    + "&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m"
                    + "&timezone=" + TIMEZONE;

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(Map.class);

            if (response == null || !response.containsKey("hourly")) {
                return fallbackResponse(dateStr, effectiveTime);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> hourly = (Map<String, Object>) response.get("hourly");
            @SuppressWarnings("unchecked")
            List<String> times = (List<String>) hourly.get("time");
            @SuppressWarnings("unchecked")
            List<Number> temperatures = (List<Number>) hourly.get("temperature_2m");
            @SuppressWarnings("unchecked")
            List<Number> humidities = (List<Number>) hourly.get("relative_humidity_2m");
            @SuppressWarnings("unchecked")
            List<Number> pressures = (List<Number>) hourly.get("surface_pressure");
            @SuppressWarnings("unchecked")
            List<Number> winds = (List<Number>) hourly.get("wind_speed_10m");

            int index = findTimeIndex(times, effectiveTime);

            BigDecimal temp = toBigDecimal(temperatures.get(index)).setScale(1, RoundingMode.HALF_UP);
            int humidity = toBigDecimal(humidities.get(index)).setScale(0, RoundingMode.HALF_UP).intValue();
            BigDecimal pressureHpa = toBigDecimal(pressures.get(index));
            BigDecimal pressureKpa = pressureHpa.divide(BigDecimal.TEN, 3, RoundingMode.HALF_UP);
            BigDecimal wind = toBigDecimal(winds.get(index)).setScale(1, RoundingMode.HALF_UP);

            return new WeatherResponse(dateStr, effectiveTime, "Шымкент", temp, humidity, pressureKpa, wind, "OPEN_METEO");
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Не удалось получить погоду для {}: {}", dateStr, e.getMessage());
            return fallbackResponse(dateStr, effectiveTime);
        }
    }

    private int findTimeIndex(List<String> times, String time) {
        String normalized = time.length() == 5 ? time : time;
        for (int i = 0; i < times.size(); i++) {
            if (times.get(i).contains("T" + normalized)) {
                return i;
            }
        }
        return findNoonIndex(times);
    }

    private int findNoonIndex(List<String> times) {
        for (int i = 0; i < times.size(); i++) {
            if (times.get(i).contains("T12:00")) return i;
        }
        return times.size() / 2;
    }

    private BigDecimal toBigDecimal(Number n) {
        if (n == null) return BigDecimal.ZERO;
        return BigDecimal.valueOf(n.doubleValue());
    }

    private WeatherResponse fallbackResponse(String dateStr, String time) {
        return new WeatherResponse(dateStr, time, "Шымкент", null, null, null, null, "UNAVAILABLE");
    }
}
