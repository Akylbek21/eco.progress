package kz.eco.content;

import kz.eco.common.ApiResponse;
import kz.eco.content.dto.ServiceCityPageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, unauthenticated surface - see SecurityConfig's permitAll matcher for
 *  /api/service-city/**. Editorial workflow lives in {@link ServiceCityReviewController}. */
@RestController
@RequestMapping("/api/service-city")
public class ServiceCityPageController {

    private final ServiceCityPageService service;

    public ServiceCityPageController(ServiceCityPageService service) {
        this.service = service;
    }

    @GetMapping("/{serviceId}")
    public ApiResponse<List<ServiceCityPageResponse>> listForService(@PathVariable String serviceId) {
        return ApiResponse.ok(service.findIndexableForService(serviceId));
    }

    @GetMapping("/{serviceId}/{citySlug}")
    public ApiResponse<ServiceCityPageResponse> get(@PathVariable String serviceId, @PathVariable String citySlug) {
        return ApiResponse.ok(service.findByServiceAndCity(serviceId, citySlug));
    }
}
