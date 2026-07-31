package kz.ecoprogress.documentflow.plan;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** Plan CRUD + public read paths, shared by the public API controller and the admin controller. */
@Service
public class PlanService {

    private final SubscriptionPlanRepository planRepository;
    private final PlanFeatureRepository planFeatureRepository;

    public PlanService(SubscriptionPlanRepository planRepository, PlanFeatureRepository planFeatureRepository) {
        this.planRepository = planRepository;
        this.planFeatureRepository = planFeatureRepository;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlan> listPublic() {
        return planRepository.findByVisibleTrueAndActiveTrueOrderBySortOrderAsc();
    }

    @Transactional(readOnly = true)
    public SubscriptionPlan getPublicByCode(String code) {
        return planRepository.findByCodeAndVisibleTrueAndActiveTrue(code)
                .orElseThrow(() -> new NotFoundException("Тарифный план не найден", "PLAN_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public List<PlanFeature> featuresOf(Long planId) {
        return planFeatureRepository.findByPlanId(planId);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlan> listAll() {
        return planRepository.findAll();
    }

    @Transactional(readOnly = true)
    public SubscriptionPlan getByIdOrThrow(Long id) {
        return planRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Тарифный план не найден", "PLAN_NOT_FOUND"));
    }

    @Transactional
    public SubscriptionPlan create(SubscriptionPlan plan, Map<FeatureCode, PlanFeatureInput> features) {
        planRepository.findByCode(plan.getCode()).ifPresent(existing -> {
            throw new ConflictException("План с кодом " + plan.getCode() + " уже существует", "PLAN_CODE_CONFLICT");
        });
        SubscriptionPlan saved = planRepository.save(plan);
        applyFeatures(saved.getId(), features);
        return saved;
    }

    @Transactional
    public SubscriptionPlan update(Long planId, SubscriptionPlan changes, Map<FeatureCode, PlanFeatureInput> features) {
        SubscriptionPlan plan = getByIdOrThrow(planId);
        if (changes.getNameRu() != null) plan.setNameRu(changes.getNameRu());
        if (changes.getNameKk() != null) plan.setNameKk(changes.getNameKk());
        if (changes.getDescriptionRu() != null) plan.setDescriptionRu(changes.getDescriptionRu());
        if (changes.getDescriptionKk() != null) plan.setDescriptionKk(changes.getDescriptionKk());
        if (changes.getBillingPeriod() != null) plan.setBillingPeriod(changes.getBillingPeriod());
        if (changes.getPrice() != null) plan.setPrice(changes.getPrice());
        if (changes.getCurrency() != null) plan.setCurrency(changes.getCurrency());
        plan.setTrialDays(changes.getTrialDays());
        plan.setActive(changes.isActive());
        plan.setVisible(changes.isVisible());
        plan.setSortOrder(changes.getSortOrder());
        SubscriptionPlan saved = planRepository.save(plan);
        if (features != null && !features.isEmpty()) {
            applyFeatures(saved.getId(), features);
        }
        return saved;
    }

    private void applyFeatures(Long planId, Map<FeatureCode, PlanFeatureInput> features) {
        if (features == null) return;
        for (Map.Entry<FeatureCode, PlanFeatureInput> entry : features.entrySet()) {
            PlanFeature row = planFeatureRepository.findByPlanIdAndFeatureCode(planId, entry.getKey())
                    .orElseGet(() -> {
                        PlanFeature created = new PlanFeature();
                        created.setPlanId(planId);
                        created.setFeatureCode(entry.getKey());
                        return created;
                    });
            PlanFeatureInput input = entry.getValue();
            if (input.enabled() == null) {
                throw new BadRequestException("enabled обязателен для функции " + entry.getKey(), "VALIDATION_ERROR");
            }
            row.setEnabled(input.enabled());
            row.setLimitValue(input.limitValue());
            row.setMetadataJson(input.metadataJson());
            planFeatureRepository.save(row);
        }
    }

    public record PlanFeatureInput(Boolean enabled, Long limitValue, String metadataJson) {
    }
}
