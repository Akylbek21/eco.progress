package kz.ecoprogress.documentflow.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanFeatureRepository extends JpaRepository<PlanFeature, Long> {
    List<PlanFeature> findByPlanId(Long planId);
    Optional<PlanFeature> findByPlanIdAndFeatureCode(Long planId, FeatureCode featureCode);
}
