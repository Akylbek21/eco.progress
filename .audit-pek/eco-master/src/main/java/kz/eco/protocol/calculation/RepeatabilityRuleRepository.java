package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RepeatabilityRuleRepository extends JpaRepository<RepeatabilityRule, Long> {
    List<RepeatabilityRule> findByMethodTemplateIdAndActiveTrue(Long methodTemplateId);
}
