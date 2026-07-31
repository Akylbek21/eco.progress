package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.PlanFeature;
import kz.ecoprogress.documentflow.plan.PlanFeatureRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/** Spring-facing wrapper around {@link EntitlementResolver} - fetches the plan's feature rows and
 *  the organization's entitlement overrides and resolves the final enabled/disabled set. */
@Service
public class EntitlementService {

    private final PlanFeatureRepository planFeatureRepository;
    private final OrganizationEntitlementRepository entitlementRepository;

    public EntitlementService(PlanFeatureRepository planFeatureRepository, OrganizationEntitlementRepository entitlementRepository) {
        this.planFeatureRepository = planFeatureRepository;
        this.entitlementRepository = entitlementRepository;
    }

    /** The plan's own flag for this feature, ignoring any entitlement override - used by callers
     *  that need to distinguish "plan never had it" from "an entitlement disabled it". */
    @Transactional(readOnly = true)
    public boolean planOnlyEnabled(Long planId, FeatureCode feature) {
        return planFeatureRepository.findByPlanIdAndFeatureCode(planId, feature)
                .map(PlanFeature::isEnabled)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(Long organizationId, Long planId, FeatureCode feature) {
        Boolean planEnabled = planFeatureRepository.findByPlanIdAndFeatureCode(planId, feature)
                .map(PlanFeature::isEnabled)
                .orElse(null);
        List<OrganizationEntitlement> entitlements = entitlementRepository.findByOrganizationIdAndFeatureCode(organizationId, feature);
        return EntitlementResolver.resolveEnabled(planEnabled, entitlements, LocalDateTime.now());
    }

    /** All features currently enabled for the organization under the given plan (plan flags plus
     *  entitlement overrides applied), used to populate AccessContext#features(). */
    @Transactional(readOnly = true)
    public Set<FeatureCode> enabledFeatures(Long organizationId, Long planId) {
        LocalDateTime now = LocalDateTime.now();
        List<PlanFeature> planFeatures = planFeatureRepository.findByPlanId(planId);
        List<OrganizationEntitlement> orgEntitlements = entitlementRepository.findByOrganizationId(organizationId);

        Set<FeatureCode> result = EnumSet.noneOf(FeatureCode.class);
        for (FeatureCode feature : FeatureCode.values()) {
            Boolean planEnabled = planFeatures.stream()
                    .filter(pf -> pf.getFeatureCode() == feature)
                    .findFirst()
                    .map(PlanFeature::isEnabled)
                    .orElse(null);
            List<OrganizationEntitlement> forFeature = orgEntitlements.stream()
                    .filter(e -> e.getFeatureCode() == feature)
                    .toList();
            if (EntitlementResolver.resolveEnabled(planEnabled, forFeature, now)) {
                result.add(feature);
            }
        }
        return result;
    }
}
