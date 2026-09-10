package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekCompanyMembershipRepository extends JpaRepository<PekCompanyMembership, Long> {

    Optional<PekCompanyMembership> findByCompanyIdAndUserIdAndStatus(Long companyId, Long userId, PekMembershipStatus status);

    List<PekCompanyMembership> findByUserIdAndStatus(Long userId, PekMembershipStatus status);

    List<PekCompanyMembership> findByCompanyIdAndStatus(Long companyId, PekMembershipStatus status);

    boolean existsByCompanyIdAndUserIdAndStatus(Long companyId, Long userId, PekMembershipStatus status);

    List<PekCompanyMembership> findByCompanyIdInAndStatus(List<Long> companyIds, PekMembershipStatus status);

    List<PekCompanyMembership> findByCompanyIdOrderByCreatedAtAsc(Long companyId);

    Optional<PekCompanyMembership> findByCompanyIdAndUserId(Long companyId, Long userId);

    Optional<PekCompanyMembership> findByIdAndCompanyId(Long id, Long companyId);
}
