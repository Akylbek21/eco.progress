package kz.eco.normative;

import kz.eco.protocol.ComparisonType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit test (no Spring context): FileTypeMapping.sourceDocumentCode() previously had no case
 * for TemplateType.WATER_WASTEWATER and silently fell through to null, so every water normative
 * imported through the generic MPC/UDMH pipeline ended up with sourceDocumentCode=null instead of
 * DSM_138 - see V22__backfill_water_source_document_code.sql for the one-time data fix.
 */
class FileTypeMappingTest {

    @Test
    void waterWastewater_mapsToDsm138() {
        FileTypeMapping mapping = new FileTypeMapping(
                EnvironmentType.WATER, TemplateType.WATER_WASTEWATER, ImportNormativeType.PDK,
                ComparisonType.LESS_OR_EQUAL, false, false);

        assertEquals(SourceDocumentCode.DSM_138.name(), mapping.sourceDocumentCode());
        assertEquals(SourceDocumentCode.DSM_138.documentName(), mapping.sourceDocumentName());
    }

    @Test
    void mpcWaterUdmhFile_resolvesToWaterWastewaterAndDsm138() {
        FileTypeMapping mapping = FileTypeMapping.resolve("MPC_water_UDMH_and_rocket_fuel_components.xls.xls");

        assertNotNull(mapping, "the UDMH water file must be recognized by FileTypeMapping");
        assertEquals(TemplateType.WATER_WASTEWATER, mapping.templateType());
        assertEquals(SourceDocumentCode.DSM_138.name(), mapping.sourceDocumentCode());
    }

    @Test
    void mpcAtmosphericAirUdmhFile_resolvesToDsm70() {
        FileTypeMapping mapping = FileTypeMapping.resolve("MPC_atmospheric_air_UDMH_and_rocket_fuel_components.xls.xls");

        assertNotNull(mapping);
        assertEquals(SourceDocumentCode.DSM_70.name(), mapping.sourceDocumentCode());
    }

    @Test
    void mpcWorkZoneAirUdmhFile_resolvesToDsm70() {
        FileTypeMapping mapping = FileTypeMapping.resolve("MPC_work_zone_air_UDMH_and_rocket_fuel_components.xls.xls");

        assertNotNull(mapping);
        assertEquals(SourceDocumentCode.DSM_70.name(), mapping.sourceDocumentCode());
    }

    @Test
    void soilTemplate_stillMapsToDsm32_unaffectedByWaterFix() {
        FileTypeMapping mapping = new FileTypeMapping(
                EnvironmentType.SOIL, TemplateType.SOIL, ImportNormativeType.PDK,
                ComparisonType.LESS_OR_EQUAL, false, false);

        assertEquals(SourceDocumentCode.DSM_32.name(), mapping.sourceDocumentCode());
    }
}
