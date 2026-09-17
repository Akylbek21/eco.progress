package kz.ecoprogress.documentflow.admin;

import jakarta.validation.Valid;
import kz.eco.common.ApiResponse;
import kz.ecoprogress.documentflow.admin.dto.PlanAdminDto;
import kz.ecoprogress.documentflow.admin.dto.PlanCreateRequest;
import kz.ecoprogress.documentflow.admin.dto.PlanUpdateRequest;
import kz.ecoprogress.documentflow.plan.BillingPeriod;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.PlanService;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/document-flow/plans")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPlanController {

    private final PlanService planService;

    public AdminPlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping
    public ApiResponse<List<PlanAdminDto>> list() {
        List<PlanAdminDto> plans = planService.listAll().stream()
                .map(p -> PlanAdminDto.from(p, planService.featuresOf(p.getId())))
                .toList();
        return ApiResponse.ok(plans);
    }

    @PostMapping
    public ApiResponse<PlanAdminDto> create(@Valid @RequestBody PlanCreateRequest request) {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setCode(request.code());
        plan.setNameRu(request.nameRu());
        plan.setNameKk(request.nameKk());
        plan.setDescriptionRu(request.descriptionRu());
        plan.setDescriptionKk(request.descriptionKk());
        plan.setBillingPeriod(request.billingPeriod());
        plan.setPrice(request.price());
        plan.setCurrency(request.currency());
        plan.setTrialDays(request.trialDays());
        plan.setActive(request.active());
        plan.setVisible(request.visible());
        plan.setSortOrder(request.sortOrder());

        Map<FeatureCode, PlanService.PlanFeatureInput> features = toFeatureInputs(request.features());
        SubscriptionPlan created = planService.create(plan, features);
        return ApiResponse.ok(PlanAdminDto.from(created, planService.featuresOf(created.getId())), "План создан");
    }

    @PatchMapping("/{planId}")
    public ApiResponse<PlanAdminDto> update(@PathVariable Long planId, @RequestBody PlanUpdateRequest request) {
        SubscriptionPlan changes = new SubscriptionPlan();
        changes.setNameRu(request.nameRu());
        changes.setNameKk(request.nameKk());
        changes.setDescriptionRu(request.descriptionRu());
        changes.setDescriptionKk(request.descriptionKk());
        changes.setBillingPeriod(request.billingPeriod() != null ? request.billingPeriod() : BillingPeriod.MONTHLY);
        changes.setPrice(request.price());
        changes.setCurrency(request.currency());
        SubscriptionPlan existing = planService.getByIdOrThrow(planId);
        changes.setTrialDays(request.trialDays() != null ? request.trialDays() : existing.getTrialDays());
        changes.setActive(request.active() != null ? request.active() : existing.isActive());
        changes.setVisible(request.visible() != null ? request.visible() : existing.isVisible());
        changes.setSortOrder(request.sortOrder() != null ? request.sortOrder() : existing.getSortOrder());
        if (request.billingPeriod() == null) {
            changes.setBillingPeriod(existing.getBillingPeriod());
        }

        Map<FeatureCode, PlanService.PlanFeatureInput> features = request.features() != null
                ? toFeatureInputs(request.features())
                : Map.of();
        SubscriptionPlan updated = planService.update(planId, changes, features);
        return ApiResponse.ok(PlanAdminDto.from(updated, planService.featuresOf(updated.getId())), "План обновлён");
    }

    private Map<FeatureCode, PlanService.PlanFeatureInput> toFeatureInputs(Map<FeatureCode, PlanCreateRequest.PlanFeatureRequest> raw) {
        Map<FeatureCode, PlanService.PlanFeatureInput> result = new HashMap<>();
        if (raw == null) return result;
        raw.forEach((code, f) -> result.put(code, new PlanService.PlanFeatureInput(f.enabled(), f.limitValue(), f.metadataJson())));
        return result;
    }
}
