package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Exercises the exact wiring used by POST /api/normatives/import-resources so regressions in
 * that wiring (e.g. DSM_32 silently going through the wrong pipeline) are caught, not just
 * regressions in the individual parsers.
 */
@SpringBootTest
@Transactional
class NormativeResourceImportServiceTest {

    private static final List<String> JUNK_CODES = List.of("а", "a", "п", "п+а", "п+a");

    @Autowired
    private NormativeResourceImportService resourceImportService;

    @Autowired
    private NormativeDirectoryService directoryService;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @Test
    void importDsm70_populatesBothAmbientAndWorkplaceAirTabs() throws Exception {
        resourceImportService.importResources("DSM_70");

        List<ProtocolApiDtos.NormativeRecord> ambient = searchActive(
                NormativeApiContract.TEMPLATE_AMBIENT_AIR, SourceDocumentCode.DSM_70.name());
        List<ProtocolApiDtos.NormativeRecord> workplace = searchActive(
                NormativeApiContract.TEMPLATE_WORKPLACE_AIR, SourceDocumentCode.DSM_70.name());

        assertTrue(ambient.size() > 500, "ambient_air=" + ambient.size());
        assertTrue(workplace.size() > 500, "workplace_air=" + workplace.size());
        assertTrue(workplace.stream().noneMatch(r -> r.pollutantCode() != null
                && JUNK_CODES.contains(r.pollutantCode().toLowerCase())));
    }

    @Test
    void importDsm32_populatesSoilTabWithFullDataset_notJustOneRecord() throws Exception {
        resourceImportService.importResources("DSM_32");

        List<NormativeRecord> soil = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_32.name());
        assertTrue(soil.size() > 50, "DSM_32 active records=" + soil.size());

        List<ProtocolApiDtos.NormativeRecord> soilApi = searchActive(
                NormativeApiContract.TEMPLATE_SOIL, SourceDocumentCode.DSM_32.name());
        assertTrue(soilApi.size() > 50, "soil templateId records=" + soilApi.size());
    }

    @Test
    void importDsm15_populatesPhysicalFactorsWithFactorTypeAndCode() throws Exception {
        NormativeResourceImportService.ImportResourcesResult result = resourceImportService.importResources("DSM_15");

        assertNotNull(result.physicalFactorDetails());
        assertTrue(result.physicalFactorDetails().processedFiles() >= 40,
                "should process all manifest files except OTHER_REVIEW: processedFiles=" + result.physicalFactorDetails().processedFiles());

        List<NormativeRecord> physical = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_15.name());
        assertFalse(physical.isEmpty());
        assertTrue(physical.stream().noneMatch(r -> "OTHER_REVIEW".equalsIgnoreCase(r.getFactorType())),
                "OTHER_REVIEW is not a real physical factor table and must be skipped");
        assertTrue(physical.stream().allMatch(r -> r.getFactorType() != null && !r.getFactorType().isBlank()
                        && r.getFactorCode() != null && !r.getFactorCode().isBlank()),
                "every DSM_15 record must carry factorType/factorCode for the API contract");

        List<ProtocolApiDtos.NormativeRecord> physicalApi = searchActive(
                NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS, SourceDocumentCode.DSM_15.name());
        assertFalse(physicalApi.isEmpty());
    }

    private List<ProtocolApiDtos.NormativeRecord> searchActive(String templateId, String sourceDocumentCode) {
        NormativeDirectoryService.NormativeQuery query = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, templateId, null, null, null, null, null, null,
                null, null, null, true,
                sourceDocumentCode, null, null, null, null, null, null, null,
                null, null);
        return directoryService.search(query);
    }
}
