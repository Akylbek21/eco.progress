package kz.eco.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolTemplateTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    /**
     * GET /api/protocols/templates is sourced from ProtocolTypeRegistry.findActive() (the same
     * registry quick-create validates against), not the raw ProtocolTemplateCode DB-code enum -
     * so it returns exactly the 9 canonical protocol types (e.g. "ambient_air_szz"), never legacy
     * aliases like "ambient_air"/"water_wastewater" as separate entries.
     */
    @Test
    @WithMockUser(roles = "LABORATORY")
    void templates_returnsExactlyTheNineCanonicalTypes() throws Exception {
        mockMvc.perform(get("/api/protocols/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(9)))
                .andExpect(jsonPath("$.data[?(@.id == 'ambient_air_szz')].active").value(true))
                .andExpect(jsonPath("$.data[?(@.id == 'industrial_emissions')].active").value(true))
                .andExpect(jsonPath("$.data[?(@.id == 'water')].sourceDocumentCode").value("DSM_138"))
                .andExpect(jsonPath("$.data[?(@.id == 'soil')].docxTemplateCode").value("protocol_soil"))
                .andExpect(jsonPath("$.data[?(@.id == 'microclimate')].resultMode").value("PHYSICAL"))
                .andExpect(jsonPath("$.data[?(@.id == 'lighting')].resultMode").value("PHYSICAL"))
                .andExpect(jsonPath("$.data[?(@.id == 'noise_vibration')].docxTemplateCode")
                        .value("protocol_noise_vibration"))
                .andExpect(jsonPath("$.data[?(@.id == 'uv_emf_laser')].docxTemplateCode")
                        .value("protocol_physical_factors"))
                .andExpect(jsonPath("$.data[?(@.id == 'workplace_air')].name")
                        .value("Воздух рабочей зоны"));
    }
}
