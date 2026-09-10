package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UncertaintyRuleRepository extends JpaRepository<UncertaintyRule, Long> {
    List<UncertaintyRule> findByMethodTemplateIdAndActiveTrue(Long methodTemplateId);
}
