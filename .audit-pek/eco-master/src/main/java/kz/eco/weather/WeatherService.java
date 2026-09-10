package kz.eco.weather;

import kz.eco.common.exception.BadRequestException;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Module spec §11: coordinates must come from the requested object (validated against the
 * requesting company when companyId is supplied), falling back to caller-supplied
 * latitude/longitude only when the object has none, and returning an explicit
 * {@code available=false} envelope - never silently falling back to a fixed city - when no
 * coordinates are available at all. Previously this always queried Shymkent's fixed coordinates
 * and ignored objectId entirely.
 */
@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    private static final String TIMEZONE = "Asia/Almaty";
    private static final String BASE_URL = "https://archive-api.open-meteo.com/v1/archive";
    private static final int MAX_ATTEMPTS = 2;
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final CompanyObjectRepository companyObjectRepository;
    private final RestClient restClient;

    public WeatherService(CompanyObjectRepository companyObjectRepository) {
        this.companyObjectRepository = companyObjectRepository;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) TIMEOUT.toMillis());
        factory.setReadTimeout((int) TIMEOUT.toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public WeatherResponse getWeather(String dateStr, Long objectId, String time) {
        return getWeather(dateStr, objectId, null, time, null, null);
    }

    /**
     * @param companyId when supplied together with objectId, the object must belong to this
     *                   company (module spec §11 step 2) - a mismatch is a 400, not a silent
     *                   fallback to the request-supplied coordinates.
     * @param fallbackLatitude/@param fallbackLongitude used only when the object has no stored
     *                   coordinates (or no objectId was supplied at all).
     */
    public WeatherResponse getWeather(String dateStr, Long objectId, Long companyId, String time,
                                       BigDecimal fallbackLatitude, BigDecimal fallbackLongitude) {
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

        double[] coordinates = resolveCoordinates(objectId, companyId, fallbackLatitude, fallbackLongitude);
        if (coordinates == null) {
            return unavailableResponse(dateStr, effectiveTime,
                    "Координаты объекта не заданы и не переданы явно - погода недоступна");
        }
        double latitude = coordinates[0];
        double longitude = coordinates[1];

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return fetchWeather(dateStr, effectiveTime, latitude, longitude);
            } catch (Exception ex) {
                log.warn("Weather fetch attempt {}/{} failed for lat={}, lon={}, date={}: {}",
                        attempt, MAX_ATTEMPTS, latitude, longitude, dateStr, ex.toString());
                if (attempt == MAX_ATTEMPTS) {
                    log.error("Weather data unavailable after {} attempts (lat={}, lon={}, date={})",
                            MAX_ATTEMPTS, latitude, longitude, dateStr, ex);
                }
            }
        }
        return unavailableResponse(dateStr, effectiveTime, "Погодные данные недоступны");
    }

    /** Returns {latitude, longitude} or null when none could be resolved. Object coordinates
     *  always win over the caller-supplied fallback when both are present (spec step order:
     *  object first, fallback only when the object has none). */
    private double[] resolveCoordinates(Long objectId, Long companyId, BigDecimal fallbackLatitude, BigDecimal fallbackLongitude) {
        if (objectId != null) {
            CompanyObject object = companyId != null
                    ? companyObjectRepository.findByIdAndCompanyId(objectId, companyId).orElse(null)
                    : companyObjectRepository.findById(objectId).orElse(null);
            if (object == null) {
                if (companyId != null) {
                    throw new BadRequestException("Объект не найден или не принадлежит компании: " + objectId);
                }
                throw new BadRequestException("Объект не найден: " + objectId);
            }
            double[] parsed = parseCoordinates(object.getCoordinates());
            if (parsed != null) {
                return parsed;
            }
        }
        if (fallbackLatitude != null && fallbackLongitude != null) {
            return new double[]{fallbackLatitude.doubleValue(), fallbackLongitude.doubleValue()};
        }
        return null;
    }

    /** Same "lat,lon" free-text format CompanyService already validates on write - see
     *  CompanyService's coordinates field-error checks. Malformed/missing input is treated as "no
     *  coordinates" here (already validated at write time), not re-reported as a client error. */
    private double[] parseCoordinates(String coordinates) {
        if (coordinates == null || coordinates.isBlank()) {
            return null;
        }
        String[] parts = coordinates.split(",");
        if (parts.length != 2) {
            return null;
        }
        try {
            double lat = Double.parseDouble(parts[0].trim());
            double lon = Double.parseDouble(parts[1].trim());
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                return null;
            }
            return new double[]{lat, lon};
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private WeatherResponse fetchWeather(String dateStr, String effectiveTime, double latitude, double longitude) {
        String url = BASE_URL + "?latitude=" + latitude
                + "&longitude=" + longitude
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
            throw new IllegalStateException("Open-Meteo response missing 'hourly' data");
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

        return new WeatherResponse(dateStr, effectiveTime, null, temp, humidity, pressureKpa, wind, "OPEN_METEO",
                true, BigDecimal.valueOf(latitude), BigDecimal.valueOf(longitude), null);
    }

    private int findTimeIndex(List<String> times, String time) {
        for (int i = 0; i < times.size(); i++) {
            if (times.get(i).contains("T" + time)) {
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

    /** Module spec §11: never return empty values dressed up as a success - available=false and
     *  no numeric fields at all. */
    private WeatherResponse unavailableResponse(String dateStr, String time, String message) {
        return new WeatherResponse(dateStr, time, null, null, null, null, null, "UNAVAILABLE",
                false, null, null, message);
    }
}
