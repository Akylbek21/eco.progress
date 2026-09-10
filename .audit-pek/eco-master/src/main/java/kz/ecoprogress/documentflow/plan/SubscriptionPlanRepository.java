package kz.ecoprogress.documentflow.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {
    Optional<SubscriptionPlan> findByCode(String code);
    List<SubscriptionPlan> findByVisibleTrueAndActiveTrueOrderBySortOrderAsc();
    Optional<SubscriptionPlan> findByCodeAndVisibleTrueAndActiveTrue(String code);
}
