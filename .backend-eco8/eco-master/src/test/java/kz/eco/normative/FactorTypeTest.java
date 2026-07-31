package kz.eco.normative;

import kz.eco.common.exception.ValidationException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FactorTypeTest {

    @Test
    void fromApi_acceptsCanonicalValues() {
        for (FactorType type : FactorType.values()) {
            assertEquals(type, FactorType.fromApi(type.name()));
            assertEquals(type.name(), FactorType.fromApi(type.name()).toApi());
        }
    }

    @Test
    void fromApi_ultravioletAliasesToUv() {
        assertEquals(FactorType.UV, FactorType.fromApi("ULTRAVIOLET"));
        assertEquals("UV", FactorType.fromApi("ULTRAVIOLET").toApi());
    }

    @Test
    void fromApi_emfAliasesToElectromagneticField() {
        assertEquals(FactorType.ELECTROMAGNETIC_FIELD, FactorType.fromApi("EMF"));
        assertEquals("ELECTROMAGNETIC_FIELD", FactorType.fromApi("EMF").toApi());
    }

    @Test
    void fromApi_isCaseInsensitiveAndTrims() {
        assertEquals(FactorType.NOISE, FactorType.fromApi("  noise  "));
    }

    @Test
    void fromApi_rejectsUnknownValue() {
        assertThrows(ValidationException.class, () -> FactorType.fromApi("NOT_A_FACTOR"));
    }

    @Test
    void fromApi_rejectsBlank() {
        assertThrows(ValidationException.class, () -> FactorType.fromApi(""));
        assertThrows(ValidationException.class, () -> FactorType.fromApi(null));
    }

    @Test
    void isValid_acceptsAliasesAndCanonicalNames() {
        assertTrue(FactorType.isValid("ULTRAVIOLET"));
        assertTrue(FactorType.isValid("EMF"));
        assertTrue(FactorType.isValid("MICROCLIMATE"));
        assertFalse(FactorType.isValid("SOMETHING_ELSE"));
        assertFalse(FactorType.isValid(null));
    }
}
