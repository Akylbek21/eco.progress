package kz.eco.normative;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class NormativeRecordsApiTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void records_returnsMergedList() throws Exception {
        mockMvc.perform(get("/api/normatives/records").param("status", "ALL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records.length()").value(greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data.normatives.length()").value(greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data.items.length()").value(greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data.records[0].id").exists())
                .andExpect(jsonPath("$.data.records[0].templateId").exists())
                .andExpect(jsonPath("$.data.records[0].indicator").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void records_active_returnsClassifiedContract() throws Exception {
        mockMvc.perform(get("/api/normatives/records").param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[*].templateId", everyItem(notNullValue())))
                .andExpect(jsonPath("$.data.records[*].sourceDocumentCode", everyItem(notNullValue())))
                .andExpect(jsonPath("$.data.records[*].active", everyItem(is(true))))
                .andExpect(jsonPath("$.data.records[*].archived", everyItem(is(false))));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void records_searchByQueryParam() throws Exception {
        mockMvc.perform(get("/api/normatives/records").param("query", "азот"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.records[?(@.indicator =~ /.*[Аа]зот.*/i)]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void records_searchByQParam() throws Exception {
        mockMvc.perform(get("/api/normatives/records").param("q", "железо").param("status", "ALL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void records_allowedForAdmin() throws Exception {
        mockMvc.perform(get("/api/normatives/records"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @WithMockUser(roles = "CLIENT")
    void records_forbiddenForClient() throws Exception {
        mockMvc.perform(get("/api/normatives/records"))
                .andExpect(status().isForbidden());
    }

    @Test
    void records_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/normatives/records"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_returnsRecordsPayload() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("query", "азот"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.records").isArray())
                .andExpect(jsonPath("$.data.normatives").isArray())
                .andExpect(jsonPath("$.data.items").isArray());
    }
}
