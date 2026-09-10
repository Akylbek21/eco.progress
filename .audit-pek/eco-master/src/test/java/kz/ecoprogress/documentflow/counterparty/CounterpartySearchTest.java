package kz.ecoprogress.documentflow.counterparty;

import kz.eco.common.PageResponse;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Module spec §15: server-side search by name/BIN, case-insensitive, BIN formatting-agnostic. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class CounterpartySearchTest {

    @Autowired private CounterpartyService counterpartyService;
    @Autowired private DocumentFlowTestFixtures fixtures;

    private final Long orgId = 1L;
    private final Long userId = 1L;

    @Test
    void search_byNameCaseInsensitive_findsMatch() {
        fixtures.grantFullAccess(userId, orgId);
        counterpartyService.create(userId, orgId, "123456789012", "ТОО Ромашка", null, null, null, null, null);

        PageResponse<Counterparty> result = counterpartyService.search(
                userId, orgId, "ромашка", null, PageRequest.of(0, 20));

        assertEquals(1, result.items().size());
    }

    @Test
    void search_byBinIgnoringFormatting_findsMatch() {
        fixtures.grantFullAccess(userId, orgId);
        counterpartyService.create(userId, orgId, "123456789012", "ТОО Тест БИН", null, null, null, null, null);

        PageResponse<Counterparty> result = counterpartyService.search(
                userId, orgId, "123 456-789012", null, PageRequest.of(0, 20));

        assertEquals(1, result.items().size());
    }

    @Test
    void search_isTenantIsolated() {
        fixtures.grantFullAccess(userId, orgId);
        fixtures.grantFullAccess(userId, 2L);
        counterpartyService.create(userId, orgId, "111111111111", "Own Org Counterparty", null, null, null, null, null);
        counterpartyService.create(userId, 2L, "222222222222", "Other Org Counterparty", null, null, null, null, null);

        PageResponse<Counterparty> result = counterpartyService.search(
                userId, orgId, "Org Counterparty", null, PageRequest.of(0, 20));

        assertTrue(result.items().stream().allMatch(c -> c.getOwnerOrganizationId().equals(orgId)));
    }
}
