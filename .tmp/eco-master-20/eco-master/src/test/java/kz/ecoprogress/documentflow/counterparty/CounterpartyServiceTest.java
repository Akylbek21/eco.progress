package kz.ecoprogress.documentflow.counterparty;

import kz.eco.EcoApplication;
import kz.eco.common.exception.ConflictException;
import kz.ecoprogress.documentflow.access.DocumentFlowMembershipRequiredException;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = EcoApplication.class)
@Transactional
class CounterpartyServiceTest {

    @Autowired private CounterpartyService counterpartyService;
    @Autowired private DocumentFlowTestFixtures fixtures;

    private final Long userId = 1L;
    private final Long organizationId = 8001L;

    @Test
    void duplicateBin_forSameOwnerOrganization_isRejected() {
        fixtures.grantFullAccess(userId, organizationId);
        counterpartyService.create(userId, organizationId, "990022334455", "ТОО Первый", null, null, null, null, null);

        ConflictException ex = assertThrows(ConflictException.class, () ->
                counterpartyService.create(userId, organizationId, "990022334455", "ТОО Дубликат", null, null, null, null, null));
        assertEquals("COUNTERPARTY_DUPLICATE_BIN", ex.getCode());
    }

    @Test
    void sameBin_differentFormatting_isStillRejectedAsDuplicate() {
        fixtures.grantFullAccess(userId, organizationId);
        counterpartyService.create(userId, organizationId, "990-022-334455", "ТОО Первый", null, null, null, null, null);

        assertThrows(ConflictException.class, () ->
                counterpartyService.create(userId, organizationId, "990 022 334455", "ТОО Дубликат", null, null, null, null, null));
    }

    @Test
    void sameBin_differentOwnerOrganization_isAllowed() {
        Long otherOrganizationId = organizationId + 1;
        fixtures.grantFullAccess(userId, organizationId);
        fixtures.grantFullAccess(userId, otherOrganizationId);
        counterpartyService.create(userId, organizationId, "990022334455", "ТОО Первый", null, null, null, null, null);
        Counterparty other = counterpartyService.create(userId, otherOrganizationId, "990022334455", "ТОО Второй",
                null, null, null, null, null);
        assertEquals("990022334455", other.getNormalizedBin());
    }

    @Test
    void create_withoutMembership_isRejected() {
        assertThrows(DocumentFlowMembershipRequiredException.class, () ->
                counterpartyService.create(userId, organizationId, "990022334455", "ТОО Без доступа",
                        null, null, null, null, null));
    }

    @Test
    void list_withoutMembership_isRejected() {
        assertThrows(DocumentFlowMembershipRequiredException.class, () ->
                counterpartyService.list(userId, organizationId, PageRequest.of(0, 20)));
    }
}
