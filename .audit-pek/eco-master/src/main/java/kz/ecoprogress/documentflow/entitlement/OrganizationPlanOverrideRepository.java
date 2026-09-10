package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationPlanOverrideRepository extends JpaRepository<OrganizationPlanOverride, Long> {
    List<OrganizationPlanOverride> findByOrganizationId(Long organizationId);
    List<OrganizationPlanOverride> findByOrganizationIdAndFeatureCode(Long organizationId, FeatureCode featureCode);

    /** Same (organizationId, featureCode) scope as {@link #findByOrganizationIdAndFeatureCode}, but
     *  additionally scoped by {@code metric} (nullable-safe via IS NULL / IS NOT NULL is not needed
     *  here since callers always pass the same metric value they are about to insert - null for
     *  every featureCode except CUSTOM_LIMITS). Used to close out the previous active row(s) before
     *  inserting a new override for the same limit, so two rows never both read as "currently
     *  active" for the same organization+metric at once. */
    List<OrganizationPlanOverride> findByOrganizationIdAndFeatureCodeAndMetric(Long organizationId, FeatureCode featureCode, String metric);
}
