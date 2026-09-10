package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProtocolTypeRegistryTest {

    @Test
    void allEightTypes_resolveByCanonicalId() {
        assertEquals("ambient_air", ProtocolTypeRegistry.require("ambient_air").templateId());
        assertEquals("workplace_air", ProtocolTypeRegistry.require("workplace_air").templateId());
        assertEquals("soil", ProtocolTypeRegistry.require("soil").templateId());
        assertEquals("water", ProtocolTypeRegistry.require("water").templateId());
        assertEquals("microclimate", ProtocolTypeRegistry.require("microclimate").templateId());
        assertEquals("lighting", ProtocolTypeRegistry.require("lighting").templateId());
        assertEquals("noise_vibration", ProtocolTypeRegistry.require("noise_vibration").templateId());
        assertEquals("uv_emf_laser", ProtocolTypeRegistry.require("uv_emf_laser").templateId());
    }

    @Test
    void legacyAliases_resolveToNewCanonicalIds() {
        assertEquals("water", ProtocolTypeRegistry.require("water_wastewater").templateId());
        assertEquals("ambient_air", ProtocolTypeRegistry.require("ambient_air_szz").templateId());
    }

    @Test
    void unknownTemplateId_throwsBadRequest() {
        assertThrows(BadRequestException.class, () -> ProtocolTypeRegistry.require("not_a_real_type"));
    }

    /** The bare legacy "physical_factors" bucket must never silently default to microclimate -
     * lighting/noise_vibration/uv_emf_laser protocols were being misfiled as microclimate before
     * this was fixed. */
    @Test
    void bareLegacyPhysicalFactorsBucket_isNeverAutoResolved() {
        assertNull(ProtocolTypeRegistry.resolve("physical_factors"));
        assertThrows(BadRequestException.class, () -> ProtocolTypeRegistry.require("physical_factors"));
    }

    @Test
    void physicalFactorsWithExplicitSubtype_resolvesToTheRealType() {
        assertEquals("lighting", ProtocolTypeRegistry.require("physical_factors", "LIGHTING").templateId());
        assertEquals("noise_vibration", ProtocolTypeRegistry.require("physical_factors", "NOISE_VIBRATION").templateId());
        assertEquals("uv_emf_laser", ProtocolTypeRegistry.require("physical_factors", "UV_EMF_LASER").templateId());
        assertEquals("microclimate", ProtocolTypeRegistry.require("physical_factors", "MICROCLIMATE").templateId());
        // Case-insensitive, since frontend/legacy data isn't guaranteed to send uppercase.
        assertEquals("lighting", ProtocolTypeRegistry.require("physical_factors", "lighting").templateId());
    }

    @Test
    void physicalFactorsWithoutSubtype_returns400NotMicroclimate() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> ProtocolTypeRegistry.require("physical_factors", null));
        assertTrue(ex.getMessage().contains("subtype"));
    }

    @Test
    void physicalFactorsWithUnknownSubtype_returns400() {
        assertThrows(BadRequestException.class,
                () -> ProtocolTypeRegistry.require("physical_factors", "NOT_A_REAL_SUBTYPE"));
    }

    @Test
    void concreteTemplateId_ignoresIrrelevantSubtype() {
        // lighting is already unambiguous on its own - a stray/mismatched subtype must not matter.
        assertEquals("lighting", ProtocolTypeRegistry.require("lighting", "MICROCLIMATE").templateId());
    }

    @Test
    void findSupportsAndFindActive_exposeTheSameEightTypes() {
        assertTrue(ProtocolTypeRegistry.find("soil").isPresent());
        assertTrue(ProtocolTypeRegistry.find("not_a_real_type").isEmpty());
        assertTrue(ProtocolTypeRegistry.supports("water"));
        assertFalse(ProtocolTypeRegistry.supports("not_a_real_type"));

        var active = ProtocolTypeRegistry.findActive();
        assertEquals(8, active.size(), "all 8 registered types have a real docx template on the classpath");
        assertTrue(active.stream().allMatch(ProtocolTypeConfig::active));
    }

    @Test
    void configValues_matchSpec() {
        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        assertEquals("DSM_32", soil.sourceDocumentCode());
        assertEquals("protocol_soil", soil.docxTemplateCode());
        assertEquals("мг/кг", soil.defaultUnit());
        assertEquals(ProtocolTypeConfig.ResultMode.CHEMICAL, soil.resultMode());

        ProtocolTypeConfig water = ProtocolTypeRegistry.require("water");
        assertEquals("DSM_138", water.sourceDocumentCode(), "water normatives come from DSM_138");
        assertEquals("water_wastewater", water.normativeTemplateId());

        ProtocolTypeConfig microclimate = ProtocolTypeRegistry.require("microclimate");
        assertEquals(ProtocolTypeConfig.ResultMode.PHYSICAL, microclimate.resultMode());
        assertEquals("physical_factors", microclimate.normativeTemplateId());
        assertNull(microclimate.defaultUnit());
    }

    @Test
    void validateConsistency_acceptsMatchingCodes() {
        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        assertDoesNotThrow(() -> ProtocolTypeRegistry.validateConsistency(soil, "DSM_32", "protocol_soil"));
        assertDoesNotThrow(() -> ProtocolTypeRegistry.validateConsistency(soil, null, null));
    }

    @Test
    void validateConsistency_rejectsMismatchedDocxTemplate() {
        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> ProtocolTypeRegistry.validateConsistency(soil, null, "protocol_microclimate"));
        assertEquals("Шаблон печати не соответствует типу протокола", ex.getMessage());
    }

    @Test
    void validateConsistency_rejectsMismatchedSourceDocument() {
        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        assertThrows(BadRequestException.class,
                () -> ProtocolTypeRegistry.validateConsistency(soil, "DSM_70", null));
    }
}
