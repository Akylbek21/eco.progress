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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolDocumentGenerationTest extends ProtocolApiTestSupport {

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

        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/protocols/" + protocolId + "/check-normatives"))
                .andExpect(status().isOk());
    }

    @Test
    void generateAndDownloadDocx() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/generate-docx"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.docxFileId").exists())
                .andExpect(jsonPath("$.data.status").value("READY"));

        MvcResult download = mockMvc.perform(get("/api/protocols/" + protocolId + "/download-docx"))
                .andExpect(status().isOk())
                .andReturn();
        byte[] body = download.getResponse().getContentAsByteArray();
        assertTrue(body.length > 100);
        assertTrue(body[0] == 'P' && body[1] == 'K');
    }

    @Test
    void generateAndDownloadPdf() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/generate-pdf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.pdfFileId").exists())
                .andExpect(jsonPath("$.data.status").value("READY"));

        MvcResult download = mockMvc.perform(get("/api/protocols/" + protocolId + "/download-pdf"))
                .andExpect(status().isOk())
                .andReturn();
        byte[] body = download.getResponse().getContentAsByteArray();
        assertTrue(body.length > 100);
        assertTrue(body[0] == '%');
    }
}
