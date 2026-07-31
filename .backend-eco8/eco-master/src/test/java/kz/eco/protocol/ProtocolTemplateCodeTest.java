package kz.eco.protocol;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProtocolTemplateCodeTest {

    @Test
    void fromApi_workplaceAir_resolvesToDedicatedTemplate() {
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR, ProtocolTemplateCode.fromApi("workplace_air"));
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR, ProtocolTemplateCode.fromApi("work_zone_air"));
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR, ProtocolTemplateCode.fromApi("Workplace-Air"));
    }

    @Test
    void fromCode_workplaceAir_doesNotThrow() {
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR, ProtocolTemplateCode.fromCode("workplace_air"));
    }

    @Test
    void workplaceAir_isNotConflatedWithAmbientAir() {
        assertNotEquals(ProtocolTemplateCode.AMBIENT_AIR_SZZ, ProtocolTemplateCode.fromApi("workplace_air"));
        assertNotEquals("ambient_air_szz", ProtocolTemplateCode.WORKPLACE_AIR.toApiId());
    }

    @Test
    void workplaceAir_roundTripsThroughApiId() {
        assertEquals("workplace_air", ProtocolTemplateCode.WORKPLACE_AIR.toApiId());
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR,
                ProtocolTemplateCode.fromApi(ProtocolTemplateCode.WORKPLACE_AIR.toApiId()));
    }

    @Test
    void workplaceAir_isNotPhysicalFactor() {
        assertFalse(ProtocolTemplateCode.WORKPLACE_AIR.isPhysicalFactor());
    }

    @Test
    void fromDbCode_workplaceAir_resolvesFromEnumName() {
        assertEquals(ProtocolTemplateCode.WORKPLACE_AIR, ProtocolTemplateCode.fromDbCode("WORKPLACE_AIR"));
    }

    @Test
    void allTemplateCodes_haveUniqueApiIds() {
        var ids = java.util.Arrays.stream(ProtocolTemplateCode.values())
                .map(ProtocolTemplateCode::toApiId)
                .toList();
        assertEquals(ids.size(), java.util.Set.copyOf(ids).size(), "toApiId() values must be unique: " + ids);
    }
}
