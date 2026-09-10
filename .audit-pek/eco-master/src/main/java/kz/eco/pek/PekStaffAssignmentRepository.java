package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekStaffAssignmentRepository extends JpaRepository<PekStaffAssignment, Long> {

    Optional<PekStaffAssignment> findByCompanyIdAndUserIdAndStatus(Long companyId, Long userId, PekMembershipStatus status);

    List<PekStaffAssignment> findByUserIdAndStatus(Long userId, PekMembershipStatus status);

    List<PekStaffAssignment> findByCompanyIdAndStatus(Long companyId, PekMembershipStatus status);

    boolean existsByCompanyIdAndUserIdAndStatus(Long companyId, Long userId, PekMembershipStatus status);

    List<PekStaffAssignment> findByCompanyIdInAndStatus(List<Long> companyIds, PekMembershipStatus status);

    List<PekStaffAssignment> findByCompanyIdOrderByCreatedAtAsc(Long companyId);

    Optional<PekStaffAssignment> findByCompanyIdAndUserId(Long companyId, Long userId);

    Optional<PekStaffAssignment> findByIdAndCompanyId(Long id, Long companyId);
}
