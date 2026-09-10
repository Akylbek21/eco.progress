package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class NormativeMatchingUtilsTest {

    @Test
    void matches_normalizesYoToE() {
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("LIGHTING")
                .pollutantCode("LIGHTING")
                .templateId("physical_factors")
                .researchObject("workplace")
                .environment("workplace")
                .indicator("Освещённость")
                .unit("лк")
                .normativeType("PDK")
                .value("300")
                .max("300")
                .comparisonType("LESS_OR_EQUAL")
                .normativeDocument("СанПиН")
                .validFrom("2020-01-01")
                .active(true)
                .archived(false)
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "освещенность"));
    }

    @Test
    void matches_code301_finds0301() {
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("0301")
                .pollutantCode("0301")
                .indicator("Азота диоксид")
                .indicatorNameRu("Азота диоксид")
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "301"));
    }

    @Test
    void matches_query123_findsDashSeparatedCode0123() {
        // module spec §19.3: query "123" must find codes "0123", "01-23", and "01 23" alike.
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("01-23")
                .pollutantCode("01-23")
                .indicator("Железо")
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "123"));
    }

    @Test
    void matches_query123_findsSpaceSeparatedCode0123() {
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("01 23")
                .pollutantCode("01 23")
                .indicator("Железо")
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "123"));
    }

    @Test
    void matches_dashSeparatedQuery0123_findsPlainCode0123() {
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("0123")
                .pollutantCode("0123")
                .indicator("Железо")
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "01-23"));
    }

    @Test
    void matches_alphanumericCode_isNotFalselyMatchedByDigitStripping() {
        // Guard: "NO-12-3" is neither a literal substring match for "123" nor, once separators
        // are stripped, purely digits ("no123" still has letters) - the numeric-code branch must
        // stay gated to digit-only candidates so this doesn't turn into a false positive.
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .code("NO-12-3")
                .pollutantCode("NO-12-3")
                .indicator("Прочее")
                .build();
        assertFalse(NormativeMatchingUtils.matches(record, "123"));
    }

    @Test
    void matches_formulaNo2() {
        ProtocolApiDtos.NormativeRecord record = NormativeRecordBuilder.create()
                .id("1")
                .pollutantCode("0301")
                .indicator("Азота диоксид")
                .formula("NO2")
                .chemicalFormula("NO2")
                .build();
        assertTrue(NormativeMatchingUtils.matches(record, "NO2"));
    }
}
