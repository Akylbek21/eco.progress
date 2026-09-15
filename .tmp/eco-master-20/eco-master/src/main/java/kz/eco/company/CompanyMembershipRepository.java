package kz.eco.company;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompanyMembershipRepository extends JpaRepository<CompanyMembership, Long> {

    List<CompanyMembership> findByUserIdAndStatus(Long userId, CompanyMembershipStatus status);

    boolean existsByCompanyIdAndUserIdAndStatus(Long companyId, Long userId, CompanyMembershipStatus status);

    List<CompanyMembership> findByCompanyIdOrderByCreatedAtAsc(Long companyId);

    Optional<CompanyMembership> findByCompanyIdAndUserId(Long companyId, Long userId);

    Optional<CompanyMembership> findByIdAndCompanyId(Long id, Long companyId);
}
