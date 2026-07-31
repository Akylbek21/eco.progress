package kz.eco.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface QuarterResultRepository extends JpaRepository<QuarterResult, Long> {
    List<QuarterResult> findByOrderQuarterIdOrderByCreatedAtDesc(Long orderQuarterId);
    boolean existsByOrderQuarterId(Long orderQuarterId);
}
