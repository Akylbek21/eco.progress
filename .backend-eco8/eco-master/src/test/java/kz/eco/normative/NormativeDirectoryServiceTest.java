package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class NormativeDirectoryServiceTest {

    @Autowired
    private NormativeDirectoryService directoryService;

    @Autowired
    private NormativeImportService importService;

    @BeforeEach
    void importClassifiedSample() throws IOException {
        ClassPathResource resource = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        importService.importResource(resource.getContentAsByteArray(),
                "MPC_atmospheric_air_with_pollutant_codes.xls.xls", null);
    }

    private static NormativeDirectoryService.NormativeQuery query(String... search) {
        return NormativeDirectoryService.NormativeQuery.fromParams(
                null, null, null, null, null, null, null, null,
                null, null, null, null, search);
    }

    private static NormativeDirectoryService.NormativeQuery queryWithStatus(String status, String... search) {
        return NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, null, null, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                status, null, null, null, null, search);
    }

    @Test
    void listRecords_active_returnsOnlyClassifiedNormatives() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(
                NormativeDirectoryService.NormativeQuery.empty());
        assertFalse(records.isEmpty());
        assertTrue(records.stream().allMatch(NormativeApiContract::isClassified));
        assertTrue(records.stream().allMatch(item -> item.templateId() != null && item.sourceDocumentCode() != null));
        assertTrue(records.stream().allMatch(ProtocolApiDtos.NormativeRecord::active));
        assertTrue(records.stream().noneMatch(item -> Boolean.TRUE.equals(item.archived())));
    }

    @Test
    void listRecords_all_includesLegacyDemoNormatives() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(queryWithStatus("ALL"));
        assertTrue(records.size() >= 5, "Должны быть демо-нормативы: Пыль, Железо, Диоксид азота, Шум, E.coli");
        assertTrue(records.stream().anyMatch(item -> "Пыль".equals(item.indicator())));
        assertTrue(records.stream().anyMatch(item -> "Железо".equals(item.indicator())));
    }

    @Test
    void search_byQParam_findsIronInAllStatus() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(queryWithStatus("ALL", "железо"));
        assertTrue(records.stream().anyMatch(item -> "Железо".equalsIgnoreCase(item.indicator())));
    }

    @Test
    void listRecords_includesLegacyNormatives() {
        Map<String, Object> payload = directoryService.listRecords(queryWithStatus("ALL"));
        @SuppressWarnings("unchecked")
        List<ProtocolApiDtos.NormativeRecord> records = (List<ProtocolApiDtos.NormativeRecord>) payload.get("records");
        assertNotNull(records);
        assertFalse(records.isEmpty(), "Справочник должен включать legacy-нормативы из normative_references");
        assertEquals(records, payload.get("normatives"));
        assertEquals(records, payload.get("items"));
        assertTrue(records.stream().anyMatch(item -> "Диоксид азота".equals(item.indicator())));
    }

    @Test
    void search_byAzot_findsNitrogenDioxide() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(
                queryWithStatus("ACTIVE", "азот"));
        assertTrue(records.stream().anyMatch(item -> item.indicator() != null && item.indicator().toLowerCase().contains("азот")));
        assertTrue(records.stream().allMatch(NormativeApiContract::isClassified));
    }

    @Test
    void search_supportsQueryAlias() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(
                queryWithStatus("ACTIVE", "0301"));
        assertTrue(records.stream().anyMatch(item -> "0301".equals(item.pollutantCode())));
    }

    @Test
    void searchForProtocol_returnsFoundFlag() {
        ProtocolApiDtos.NormativeSearchResponse response = directoryService.searchForProtocol(
                NormativeDirectoryService.NormativeQuery.fromParams(
                        null, "ambient_air", null, null, null, null, null, null,
                        null, null, null, true, "азот"));
        assertTrue(response.found());
        assertFalse(response.normatives().isEmpty());
        assertEquals("ambient_air", response.normatives().getFirst().templateId());
        assertEquals(SourceDocumentCode.DSM_70.name(), response.normatives().getFirst().sourceDocumentCode());
    }

    @Test
    void search_byCode301_finds0301() {
        NormativeDirectoryService.NormativeQuery codeQuery = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, "ambient_air", "301", null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_70.name(), null, null, null, null, null, null, null, null, null,
                "ACTIVE", null, null, null, null, new String[0]);
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(codeQuery);
        assertTrue(records.stream().anyMatch(item -> "0301".equals(item.pollutantCode())));
        assertTrue(records.stream().allMatch(item -> "ambient_air".equals(item.templateId())));
        assertTrue(records.stream().allMatch(item -> SourceDocumentCode.DSM_70.name().equals(item.sourceDocumentCode())));
    }
}
