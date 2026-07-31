package kz.eco.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolResultApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;
    private String protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id");
    }

    @Test
    void postResult_returnsId() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.message").value("Результат сохранён"));
    }

    @Test
    void patchResult_returnsId() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk())
                .andReturn();
        String resultId = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/results/" + resultId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"primaryReading": "0.14", "unit": "мг/м³", "indicatorName": "Азота диоксид"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(resultId))
                .andExpect(jsonPath("$.data.result").value("0.14"));
    }

    @Test
    void resultWithinNormative_isNormal() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.internalStatus").value("NORMAL"))
                .andExpect(jsonPath("$.data.checkStatus").value("NORMAL"));
    }

    @Test
    void resultAboveNormative_isExceeded() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(exceededResultJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.internalStatus").value("EXCEEDED"))
                .andExpect(jsonPath("$.data.checkStatus").value("EXCEEDED"));
    }
}
