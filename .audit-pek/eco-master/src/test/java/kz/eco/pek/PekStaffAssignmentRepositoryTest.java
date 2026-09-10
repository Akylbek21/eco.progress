package kz.eco.pek;

import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
class PekStaffAssignmentRepositoryTest {

    @Autowired
    private PekStaffAssignmentRepository repository;

    private Long companyA;
    private Long companyB;
    private Long userId;
    private Long otherUserId;

    @BeforeEach
    void setUp() {
        companyA = 9001L + System.nanoTime() % 1000;
        companyB = companyA + 1;
        userId = 5001L + System.nanoTime() % 1000;
        otherUserId = userId + 1;

        save(companyA, userId, PekMembershipStatus.ACTIVE);
        save(companyB, otherUserId, PekMembershipStatus.ACTIVE);
        save(companyA, otherUserId, PekMembershipStatus.REMOVED);
    }

    private void save(Long companyId, Long uid, PekMembershipStatus status) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(uid);
        m.setTier(PekStaffTier.defaultForRole(UserRole.ECOLOGIST));
        m.setStatus(status);
        repository.save(m);
    }

    @Test
    void findByCompanyIdAndUserIdAndStatusReturnsOnlyMatchingStatus() {
        Optional<PekStaffAssignment> active = repository.findByCompanyIdAndUserIdAndStatus(companyA, userId, PekMembershipStatus.ACTIVE);
        assertTrue(active.isPresent());

        Optional<PekStaffAssignment> removedLookedUpAsActive =
                repository.findByCompanyIdAndUserIdAndStatus(companyA, otherUserId, PekMembershipStatus.ACTIVE);
        assertTrue(removedLookedUpAsActive.isEmpty());
    }

    @Test
    void findByUserIdAndStatusScopesToTheGivenUser() {
        List<PekStaffAssignment> memberships = repository.findByUserIdAndStatus(userId, PekMembershipStatus.ACTIVE);
        assertEquals(1, memberships.size());
        assertEquals(companyA, memberships.get(0).getCompanyId());
    }

    @Test
    void findByCompanyIdAndStatusScopesToTheGivenCompany() {
        List<PekStaffAssignment> memberships = repository.findByCompanyIdAndStatus(companyB, PekMembershipStatus.ACTIVE);
        assertEquals(1, memberships.size());
        assertEquals(otherUserId, memberships.get(0).getUserId());
    }

    @Test
    void existsByCompanyIdAndUserIdAndStatusIsFalseForRemovedMembership() {
        assertTrue(repository.existsByCompanyIdAndUserIdAndStatus(companyA, userId, PekMembershipStatus.ACTIVE));
        assertFalse(repository.existsByCompanyIdAndUserIdAndStatus(companyA, otherUserId, PekMembershipStatus.ACTIVE));
    }

    @Test
    void findByCompanyIdInAndStatusUnionsAcrossCompanies() {
        List<PekStaffAssignment> memberships =
                repository.findByCompanyIdInAndStatus(List.of(companyA, companyB), PekMembershipStatus.ACTIVE);
        assertEquals(2, memberships.size());
    }
}
