package kz.ecoprogress.documentflow.usage;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrganizationUsageRepository extends JpaRepository<OrganizationUsage, Long> {
    List<OrganizationUsage> findByOrganizationIdOrderByPeriodStartDesc(Long organizationId);

    default Optional<OrganizationUsage> findCurrent(Long organizationId, LocalDateTime now) {
        return findByOrganizationIdOrderByPeriodStartDesc(organizationId).stream()
                .filter(u -> !now.isBefore(u.getPeriodStart()) && now.isBefore(u.getPeriodEnd()))
                .findFirst();
    }
}
