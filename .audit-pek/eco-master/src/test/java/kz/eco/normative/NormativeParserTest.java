package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class NormativeParserTest {

    @Test
    void htmlXls_isDetectedAndParsed() throws Exception {
        byte[] bytes = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls")
                .getContentAsByteArray();
        assertTrue(HtmlTableParser.isHtmlFile(bytes));
        List<List<String>> rows = HtmlTableParser.parse(new ByteArrayInputStream(bytes)).rows();
        assertTrue(rows.size() > 10);
    }

    @Test
    void dualPdkHeader_isRecognized() throws Exception {
        byte[] bytes = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls")
                .getContentAsByteArray();
        List<List<String>> rows = HtmlTableParser.parse(new ByteArrayInputStream(bytes)).rows();
        List<String> headers = NormativeTableParser.buildMergedHeaders(rows);
        assertTrue(NormativeTableParser.isDualPdkTable(rows, headers));
    }

    @Test
    void decimalComma_normalizedToPoint() {
        assertEquals(new BigDecimal("0.04"), NormativeTableParser.normalizeDecimal("0,04"));
    }

    @Test
    void dashValue_isSkipped() {
        assertNull(NormativeTableParser.normalizeDecimal("-"));
        assertNull(NormativeTableParser.normalizeDecimal(""));
    }

    @Test
    void nitrogenDioxide_createsTwoSubTypesWithCasAndFormula() throws Exception {
        byte[] bytes = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls")
                .getContentAsByteArray();
        List<List<String>> rows = HtmlTableParser.parse(new ByteArrayInputStream(bytes)).rows();
        FileTypeMapping mapping = FileTypeMapping.resolve("MPC_atmospheric_air_with_pollutant_codes.xls");
        List<NormativeTableParser.ParsedNormativeRow> parsed = NormativeTableParser.parseDataRows(rows, mapping);

        List<NormativeTableParser.ParsedNormativeRow> no2 = parsed.stream()
                .filter(row -> "0301".equals(row.pollutantCode()))
                .toList();
        assertFalse(no2.isEmpty(), "0301 should be imported");
        assertTrue(no2.stream().anyMatch(row -> NormativeSubType.MAX_ONE_TIME.equals(row.subType())
                && row.value().compareTo(new BigDecimal("0.2")) == 0));
        assertTrue(no2.stream().anyMatch(row -> NormativeSubType.DAILY_AVERAGE.equals(row.subType())
                && row.value().compareTo(new BigDecimal("0.04")) == 0));

        NormativeTableParser.ParsedNormativeRow sample = no2.getFirst();
        assertEquals("10102-44-0", sample.casNumber());
        assertNotNull(sample.formula());
        assertTrue(sample.formula().toUpperCase().contains("NO"));
        assertNotNull(sample.limitingIndicator());
    }

    @Test
    void numericSequenceRow_isSkipped() {
        assertTrue(NormativeTableParser.isNumericSequenceRow(List.of("1", "2", "3", "4", "5", "6", "7", "8", "9")));
    }

    @Test
    void pollutantCode_preservesLeadingZero() {
        assertEquals("0301", PollutantCodeUtils.normalizePollutantCode("301"));
        assertEquals("0301", PollutantCodeUtils.normalizePollutantCode("0301"));
    }
}
