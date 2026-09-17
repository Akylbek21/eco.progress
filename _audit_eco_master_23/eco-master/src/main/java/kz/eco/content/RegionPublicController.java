package kz.eco.content;

import kz.eco.common.ApiResponse;
import kz.eco.content.dto.CityFormsDto;
import kz.eco.content.dto.ServiceCityPageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Unified CMS contract's region surface: GET /api/public/content/regions[/{slug}] - a city-level
 *  hub aggregating every indexable service-city page for that city (see
 *  ServiceCityPageService#findIndexableForCity). The narrower /api/service-city/{serviceId}/
 *  {citySlug} endpoint (a single service+city page) stays as-is - it answers a different question
 *  and isn't a duplicate of this one. */
@RestController
@RequestMapping("/api/public/content/regions")
public class RegionPublicController {

    private final CityRepository cityRepository;
    private final ServiceCityPageService pageService;

    public RegionPublicController(CityRepository cityRepository, ServiceCityPageService pageService) {
        this.cityRepository = cityRepository;
        this.pageService = pageService;
    }

    @GetMapping
    public ApiResponse<List<CityFormsDto>> list() {
        return ApiResponse.ok(cityRepository.findAll().stream()
                .filter(city -> !pageService.findIndexableForCity(city.getSlug()).isEmpty())
                .map(CityFormsDto::from)
                .toList());
    }

    @GetMapping("/{slug}")
    public ApiResponse<List<ServiceCityPageResponse>> get(@PathVariable String slug) {
        return ApiResponse.ok(pageService.findIndexableForCity(slug));
    }
}
