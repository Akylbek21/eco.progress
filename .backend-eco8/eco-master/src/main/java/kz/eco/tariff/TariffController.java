package kz.eco.tariff;

import kz.eco.common.ApiResponse;
import kz.eco.tariff.dto.TariffResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tariffs")
public class TariffController {

    private final TariffService service;

    public TariffController(TariffService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<TariffResponse>> list() {
        return ApiResponse.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<TariffResponse> get(@PathVariable String id) {
        return ApiResponse.ok(service.findById(id));
    }
}
