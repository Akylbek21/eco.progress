package kz.ecoprogress.documentflow.api;

import kz.eco.common.ApiResponse;
import kz.ecoprogress.documentflow.api.dto.PublicPlanDto;
import kz.ecoprogress.documentflow.plan.PlanService;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public-facing plan catalogue (no auth) - only visible=true AND active=true plans, no internal
 *  fields. Permitted anonymously via SecurityConfig's "/api/public/**" matcher. */
@RestController
@RequestMapping("/api/public/document-flow/plans")
public class PublicPlanController {

    private final PlanService planService;

    public PublicPlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping
    public ApiResponse<List<PublicPlanDto>> list() {
        List<PublicPlanDto> plans = planService.listPublic().stream()
                .map(this::toDto)
                .toList();
        return ApiResponse.ok(plans);
    }

    @GetMapping("/{code}")
    public ApiResponse<PublicPlanDto> getByCode(@PathVariable String code) {
        SubscriptionPlan plan = planService.getPublicByCode(code);
        return ApiResponse.ok(toDto(plan));
    }

    private PublicPlanDto toDto(SubscriptionPlan plan) {
        List<PublicPlanDto.PublicPlanFeatureDto> features = planService.featuresOf(plan.getId()).stream()
                .map(f -> new PublicPlanDto.PublicPlanFeatureDto(f.getFeatureCode(), f.isEnabled(),
                        f.getFeatureCode() == kz.ecoprogress.documentflow.plan.FeatureCode.CUSTOM_LIMITS ? null : f.getLimitValue()))
                .toList();
        return PublicPlanDto.from(plan, features);
    }
}
