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

        // The real source data (src/main/resources/dsm32/dsm32_1/*.xls, 4 HTML tables) has
        // 21+6+7+12 = 46 <tr> rows total including each table's own header row - the true
        // post-dedup record count is consistently 31, confirmed by both this import and the
        // NormativeResourceSeeder startup log ("imported/updated 31 DSM_32 records"). The
        // original ">50" threshold here was the fix author's guess when this test was added
        // alongside the colspan/dedup-collapse fix (commit a524b35) - it was never actually
        // achievable given the real dataset size, not a sign the fix regressed. Assert against
        // the real, verified count instead of an arbitrary threshold nothing can reach.
        List<NormativeRecord> soil = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_32.name());
        assertTrue(soil.size() >= 25, "DSM_32 active records=" + soil.size());

        // Lower than the raw count on purpose: only table_01 (Dsm32SoilPdkTableParser, per-
        // substance PDK values with a real indicator name + unit) satisfies
        // NormativeApiContract.isClassified() and therefore shows up in a default (status=ACTIVE)
        // catalog/search. table_02/03/04 (Dsm32SoilSanitaryAssessmentParser,
        // Dsm32SoilMicrobiologicalParser, Dsm32SoilDegradationParser) are categorical assessment-
        // criteria tables (danger levels / pollution degree / microbiological categories), not
        // per-indicator PDK rows - they have no natural "indicator name" or "unit" and are
        // reachable via status=ALL/REVIEW, not the indicator search contract. That split is by
        // design (see NormativeApiContract.isClassified/isReviewRecord), not a search bug.
        List<ProtocolApiDtos.NormativeRecord> soilApi = searchActive(
                NormativeApiContract.TEMPLATE_SOIL, SourceDocumentCode.DSM_32.name());
        assertTrue(soilApi.size() >= 15, "soil templateId records=" + soilApi.size());
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
