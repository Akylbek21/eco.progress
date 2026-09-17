package kz.eco.normative;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class NormativeSourceResolverTest {

    @Test
    void workplaceAir_resolvesToDsm70WorkZoneAir() {
        NormativeSourceResolver.ResolvedSource resolved = NormativeSourceResolver.resolve("workplace_air", null);
        assertEquals(SourceDocumentCode.DSM_70, resolved.sourceDocumentCode());
        assertEquals(EnvironmentType.WORK_ZONE_AIR, resolved.environmentType());
    }

    @Test
    void workZoneAirAlias_resolvesSameAsWorkplaceAir() {
        NormativeSourceResolver.ResolvedSource resolved = NormativeSourceResolver.resolve("work_zone_air", null);
        assertEquals(SourceDocumentCode.DSM_70, resolved.sourceDocumentCode());
        assertEquals(EnvironmentType.WORK_ZONE_AIR, resolved.environmentType());
    }

    @Test
    void workplaceAir_isNotConflatedWithAmbientAir() {
        NormativeSourceResolver.ResolvedSource workplace = NormativeSourceResolver.resolve("workplace_air", null);
        NormativeSourceResolver.ResolvedSource ambient = NormativeSourceResolver.resolve("ambient_air_szz", null);
        assertNotEquals(workplace.environmentType(), ambient.environmentType());
    }
}
