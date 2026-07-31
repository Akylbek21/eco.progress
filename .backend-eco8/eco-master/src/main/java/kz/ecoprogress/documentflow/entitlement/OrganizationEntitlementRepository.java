package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface OrganizationEntitlementRepository extends JpaRepository<OrganizationEntitlement, Long> {
    List<OrganizationEntitlement> findByOrganizationId(Long organizationId);
    List<OrganizationEntitlement> findByOrganizationIdAndFeatureCode(Long organizationId, FeatureCode featureCode);
    List<OrganizationEntitlement> findByExpiresAtBeforeAndEnabledTrue(LocalDateTime now);
}
