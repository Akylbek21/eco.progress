package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationPlanOverrideRepository extends JpaRepository<OrganizationPlanOverride, Long> {
    List<OrganizationPlanOverride> findByOrganizationId(Long organizationId);
    List<OrganizationPlanOverride> findByOrganizationIdAndFeatureCode(Long organizationId, FeatureCode featureCode);
}
