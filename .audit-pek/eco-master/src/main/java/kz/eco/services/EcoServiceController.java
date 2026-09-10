package kz.eco.services;

import kz.eco.common.ApiResponse;
import kz.eco.services.dto.EcoServiceResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Both /api/services (legacy) and /api/public/content/services (unified CMS contract) are served
 *  by these exact same handler methods - one implementation, not two that could silently drift
 *  apart. Editorial (review-workflow) endpoints live in {@link EcoServiceReviewController}. */
@RestController
@RequestMapping({"/api/services", "/api/public/content/services"})
public class EcoServiceController {

    private final EcoServiceService service;

    public EcoServiceController(EcoServiceService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<EcoServiceResponse>> list() {
        return ApiResponse.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<EcoServiceResponse> get(@PathVariable String id) {
        return ApiResponse.ok(service.findById(id));
    }
}
