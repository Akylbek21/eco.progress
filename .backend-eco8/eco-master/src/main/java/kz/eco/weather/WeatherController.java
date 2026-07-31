package kz.eco.weather;

import kz.eco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @GetMapping("/shymkent")
    public ApiResponse<WeatherResponse> getShymkentWeather(
            @RequestParam String date,
            @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) String time) {
        return ApiResponse.ok(weatherService.getWeather(date, objectId, time));
    }
}
