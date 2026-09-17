package kz.eco.normative;

import kz.eco.normative.dsm32.Dsm32EnvironmentSafetyImportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class NormativeListContractApiTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private PhysicalFactorExcelImportService physicalFactorImportService;

    @Autowired
    private Dsm32EnvironmentSafetyImportService dsm32ImportService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws IOException {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        importResource("xls/dsm-70-atmospheric-air/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        importResource("xls/dsm-70-atmospheric-air/MPC_work_zone_air_general_reference.xls.xls",
                "MPC_work_zone_air_general_reference.xls.xls");
        importResource("xls/dsm-32-environment-safety/MPC_soil_UDMH_and_rocket_fuel_components.xls.xls",
                "MPC_soil_UDMH_and_rocket_fuel_components.xls.xls");
        physicalFactorImportService.importResources();
        dsm32ImportService.importResources();
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_ambientAir_returnsOnlyDsm70AmbientAir() throws Exception {
        mockMvc.perform(get("/api/normatives")
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_70.name())
                        .param("templateId", NormativeApiContract.TEMPLATE_AMBIENT_AIR)
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(empty())))
                .andExpect(jsonPath("$.data[*].templateId", everyItem(is("ambient_air"))))
                .andExpect(jsonPath("$.data[*].sourceDocumentCode", everyItem(is("DSM_70"))))
                .andExpect(jsonPath("$.data[*].active", everyItem(is(true))))
                .andExpect(jsonPath("$.data[*].archived", everyItem(is(false))));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_workplaceAir_returnsOnlyDsm70WorkplaceAir() throws Exception {
        mockMvc.perform(get("/api/normatives")
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_70.name())
                        .param("templateId", NormativeApiContract.TEMPLATE_WORKPLACE_AIR)
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(empty())))
                .andExpect(jsonPath("$.data[*].templateId", everyItem(is("workplace_air"))))
                .andExpect(jsonPath("$.data[*].sourceDocumentCode", everyItem(is("DSM_70"))));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_soil_returnsOnlyDsm32Soil() throws Exception {
        mockMvc.perform(get("/api/normatives")
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_32.name())
                        .param("templateId", NormativeApiContract.TEMPLATE_SOIL)
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(empty())))
                .andExpect(jsonPath("$.data[*].templateId", everyItem(is("soil"))))
                .andExpect(jsonPath("$.data[*].sourceDocumentCode", everyItem(is("DSM_32"))));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_physicalFactors_returnsOnlyDsm15WithFactorFields() throws Exception {
        mockMvc.perform(get("/api/normatives")
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_15.name())
                        .param("templateId", NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS)
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(empty())))
                .andExpect(jsonPath("$.data[*].templateId", everyItem(is("physical_factors"))))
                .andExpect(jsonPath("$.data[*].sourceDocumentCode", everyItem(is("DSM_15"))))
                .andExpect(jsonPath("$.data[*].factorType", everyItem(notNullValue())))
                .andExpect(jsonPath("$.data[*].factorCode", everyItem(notNullValue())));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_physicalFactor_byConditions_returnsStableContract() throws Exception {
        mockMvc.perform(get("/api/normatives/search")
                        .param("templateId", NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS)
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_15.name())
                        .param("factorType", "MICROCLIMATE")
                        .param("factorCode", "AIR_TEMPERATURE")
                        .param("season", "COLD")
                        .param("workCategory", "IA")
                        .param("workplaceType", "PERMANENT")
                        .param("normLevel", "OPTIMAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records", not(empty())))
                .andExpect(jsonPath("$.data.records[0].templateId").value("physical_factors"))
                .andExpect(jsonPath("$.data.records[0].sourceDocumentCode").value("DSM_15"))
                .andExpect(jsonPath("$.data.records[0].factorType").value("MICROCLIMATE"))
                .andExpect(jsonPath("$.data.records[0].factorCode").value("AIR_TEMPERATURE"))
                .andExpect(jsonPath("$.data.records[0].active").value(true))
                .andExpect(jsonPath("$.data.records[0].archived").value(false));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void records_soil_returnsOnlyDsm32Soil() throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", SourceDocumentCode.DSM_32.name())
                        .param("templateId", NormativeApiContract.TEMPLATE_SOIL)
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", not(empty())))
                .andExpect(jsonPath("$.data.items[*].templateId", everyItem(is("soil"))))
                .andExpect(jsonPath("$.data.items[*].sourceDocumentCode", everyItem(is("DSM_32"))));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_active_excludesUnclassifiedRecords() throws Exception {
        mockMvc.perform(get("/api/normatives").param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].templateId", everyItem(notNullValue())))
                .andExpect(jsonPath("$.data[*].sourceDocumentCode", everyItem(notNullValue())))
                .andExpect(jsonPath("$.data[*].active", everyItem(is(true))))
                .andExpect(jsonPath("$.data[*].archived", everyItem(is(false))));
    }

    private void importResource(String classpath, String fileName) throws IOException {
        ClassPathResource resource = new ClassPathResource(classpath);
        importService.importResource(resource.getContentAsByteArray(), fileName, null);
    }
}
