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
