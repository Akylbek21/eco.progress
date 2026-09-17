package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SigningStepRepository extends JpaRepository<SigningStep, Long> {
    List<SigningStep> findAllByRouteIdOrderByStepOrderAsc(Long routeId);
}
