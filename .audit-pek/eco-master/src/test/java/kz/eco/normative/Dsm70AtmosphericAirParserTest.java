package kz.eco.normative;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure parser-level checks (no Spring context) that the four DSM_70 files import
 * (almost) completely instead of the handful of rows the old isDualPdkTable heuristic
 * and generic column matching produced.
 */
class Dsm70AtmosphericAirParserTest {

    private static final List<String> JUNK_CODES = List.of("а", "a", "п", "п+а", "п+a");

    private static List<NormativeTableParser.ParsedNormativeRow> parseResource(String fileName) throws Exception {
        byte[] bytes = new ClassPathResource("xls/dsm-70-atmospheric-air/" + fileName).getContentAsByteArray();
        List<List<String>> rows = HtmlTableParser.parse(new ByteArrayInputStream(bytes)).rows();
        FileTypeMapping mapping = FileTypeMapping.resolve(fileName);
        return NormativeTableParser.parseDataRows(rows, mapping, fileName);
    }

    @Test
    void mpcAtmosphericAirWithCodes_importsMoreThan500Rows() throws Exception {
        var parsed = parseResource("MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        assertTrue(parsed.size() > 500, "parsed=" + parsed.size());
    }

    @Test
    void oelAtmosphericAirWithCodes_importsMoreThan1000Rows() throws Exception {
        var parsed = parseResource("OEL_atmospheric_air_with_pollutant_codes.xls.xls");
        assertTrue(parsed.size() > 1000, "parsed=" + parsed.size());
    }

    @Test
    void mpcWorkZoneAirGeneralReference_importsMoreThan500Rows() throws Exception {
        var parsed = parseResource("MPC_work_zone_air_general_reference.xls.xls");
        assertTrue(parsed.size() > 500, "parsed=" + parsed.size());
    }

    @Test
    void oelWorkZoneAirGeneralReference_importsMoreThan100Rows() throws Exception {
        var parsed = parseResource("OEL_work_zone_air_general_reference.xls.xls");
        assertTrue(parsed.size() > 100, "parsed=" + parsed.size());
    }

    @Test
    void workZoneAirFiles_neverAssignPollutantCode() throws Exception {
        var mpc = parseResource("MPC_work_zone_air_general_reference.xls.xls");
        var oel = parseResource("OEL_work_zone_air_general_reference.xls.xls");

        assertFalse(mpc.isEmpty());
        assertFalse(oel.isEmpty());
        assertTrue(mpc.stream().allMatch(r -> r.pollutantCode() == null || r.pollutantCode().isBlank()),
                "MPC work zone rows must not have a pollutant code (no code column in this table)");
        assertTrue(oel.stream().allMatch(r -> r.pollutantCode() == null || r.pollutantCode().isBlank()),
                "OEL work zone rows must not have a pollutant code (no code column in this table)");
        assertTrue(mpc.stream().noneMatch(r -> r.pollutantCode() != null
                && JUNK_CODES.contains(r.pollutantCode().toLowerCase())));
        assertTrue(oel.stream().noneMatch(r -> r.pollutantCode() != null
                && JUNK_CODES.contains(r.pollutantCode().toLowerCase())));
    }

    @Test
    void code0301_isInAtmosphericAirFile_withNitrogenDioxideMaxAndDailyValues() throws Exception {
        var parsed = parseResource("MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        var no2 = parsed.stream().filter(r -> "0301".equals(r.pollutantCode())).toList();

        assertFalse(no2.isEmpty(), "0301 (Диоксид азота) should be present");
        assertTrue(no2.stream().anyMatch(r -> NormativeSubType.MAX_ONE_TIME.equals(r.subType())
                && r.value().compareTo(new BigDecimal("0.2")) == 0));
        assertTrue(no2.stream().anyMatch(r -> NormativeSubType.DAILY_AVERAGE.equals(r.subType())
                && r.value().compareTo(new BigDecimal("0.04")) == 0));
    }

    @Test
    void oelAtmosphericAirWithCodes_recordsHaveRealPollutantCodes() throws Exception {
        var parsed = parseResource("OEL_atmospheric_air_with_pollutant_codes.xls.xls");
        long withValidCode = parsed.stream()
                .filter(r -> r.pollutantCode() != null && r.pollutantCode().matches("\\d{3,10}"))
                .count();
        assertTrue(withValidCode > 1000, "withValidCode=" + withValidCode);
    }
}
