package kz.eco.weather;

import kz.eco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    /** Route kept as "/shymkent" for backward compatibility with existing frontend callers - the
     *  name no longer reflects reality (module spec §11: coordinates now come from the object,
     *  not a fixed city) but renaming it would be a breaking URL change for no functional gain. */
    @GetMapping("/shymkent")
    public ApiResponse<WeatherResponse> getWeather(
            @RequestParam String date,
            @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) String time,
            @RequestParam(required = false) BigDecimal latitude,
            @RequestParam(required = false) BigDecimal longitude) {
        return ApiResponse.ok(weatherService.getWeather(date, objectId, companyId, time, latitude, longitude));
    }
}
