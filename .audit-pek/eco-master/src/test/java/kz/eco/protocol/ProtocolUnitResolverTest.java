package kz.eco.protocol;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProtocolUnitResolverTest {

    @Test
    void explicitUnit_isUsedAsIs() {
        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        assertEquals("мг/л", ProtocolUnitResolver.resolve("мг/л", soil, null));
    }

    @Test
    void blankUnit_fallsBackToFactorCode() {
        ProtocolTypeConfig microclimate = ProtocolTypeRegistry.require("microclimate");
        assertEquals("°C", ProtocolUnitResolver.resolve(null, microclimate, "AIR_TEMPERATURE"));
        assertEquals("%", ProtocolUnitResolver.resolve("", microclimate, "HUMIDITY"));
        assertEquals("м/с", ProtocolUnitResolver.resolve(null, microclimate, "AIR_SPEED"));
    }

    @Test
    void blankUnit_fallsBackToFactorCode_lightingNoiseVibrationUv() {
        ProtocolTypeConfig lighting = ProtocolTypeRegistry.require("lighting");
        assertEquals("дБА", ProtocolUnitResolver.resolve(null, lighting, "NOISE"));
        assertEquals("лк", ProtocolUnitResolver.resolve(null, lighting, "LIGHTING"));
        assertEquals("дБ", ProtocolUnitResolver.resolve(null, lighting, "VIBRATION"));
        assertEquals("Вт/м²", ProtocolUnitResolver.resolve(null, lighting, "UV_A"));
        assertEquals("Вт/м²", ProtocolUnitResolver.resolve(null, lighting, "UV_B"));
        assertEquals("Вт/м²", ProtocolUnitResolver.resolve(null, lighting, "UV_C"));
    }

    @Test
    void blankUnit_andUnknownFactorCode_fallsBackToTypeDefaultUnit() {
        ProtocolTypeConfig ambientAir = ProtocolTypeRegistry.require("ambient_air");
        assertEquals("мг/м³", ProtocolUnitResolver.resolve(null, ambientAir, "SOME_UNKNOWN_FACTOR"));

        ProtocolTypeConfig soil = ProtocolTypeRegistry.require("soil");
        assertEquals("мг/кг", ProtocolUnitResolver.resolve("", soil, null));

        ProtocolTypeConfig water = ProtocolTypeRegistry.require("water");
        assertEquals("мг/дм³", ProtocolUnitResolver.resolve(null, water, null));
    }

    @Test
    void blankUnit_noFactorMatch_noDefaultUnit_resolvesToNull() {
        ProtocolTypeConfig microclimate = ProtocolTypeRegistry.require("microclimate");
        assertNull(ProtocolUnitResolver.resolve(null, microclimate, "SOME_UNKNOWN_FACTOR"));
    }
}
