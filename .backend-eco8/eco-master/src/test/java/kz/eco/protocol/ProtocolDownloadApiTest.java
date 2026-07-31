package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
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

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end: create a soil protocol with a result, download the DOCX on demand, and check
 * the real template rendered — not the old demo/placeholder document.
 */
@SpringBootTest
@Transactional
class ProtocolDownloadApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;
    private String protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        ensureSoilTemplate();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        templateApiId = "soil";
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        String resultJson = """
                {
                  "object": "Проба №1",
                  "indicatorName": "Мышьяк",
                  "unit": "мг/кг",
                  "testingMethodDocument": "МУ 08-47/203",
                  "normativeValue": "2.0",
                  "result": "1.62"
                }
                """;
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resultJson))
                .andExpect(status().isOk());
    }

    @Test
    void downloadDocx_rendersRealSoilTemplate() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/protocols/" + protocolId + "/download/docx"))
                .andExpect(status().isOk())
                .andReturn();

        byte[] body = result.getResponse().getContentAsByteArray();
        assertTrue(body.length > 100);
        assertTrue(body[0] == 'P' && body[1] == 'K', "must be a real DOCX (zip) file");

        String text = extractText(body);
        assertTrue(text.contains("ПРОТОКОЛ ИСПЫТАНИЙ"), "missing real title: " + text);
        assertFalse(text.contains("Демонстрационный макет"));
        assertFalse(text.toLowerCase().contains("undefined"));
        assertFalse(text.contains("null"));

        assertTrue(text.contains("ТОО Protocol Test"), "customer missing");
        assertTrue(text.contains("990011223344"), "BIN missing");
        assertTrue(text.contains("СЗЗ точка"), "object missing");
        assertTrue(text.contains("Мышьяк"), "indicator missing");
        assertTrue(text.contains("2"), "normative value missing");
        assertTrue(text.contains("1,62"), "result value missing");
    }

    private void ensureSoilTemplate() {
        if (templateRepository.findByCode("SOIL").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("SOIL");
            template.setName("Почва");
            template.setDescription("Почва");
            template.setFormCode("SOL");
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    private static String extractText(byte[] docx) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            StringBuilder sb = new StringBuilder();
            for (XWPFParagraph p : doc.getParagraphs()) {
                sb.append(p.getText()).append('\n');
            }
            for (XWPFTable table : doc.getTables()) {
                table.getRows().forEach(row -> row.getTableCells()
                        .forEach(cell -> sb.append(cell.getText()).append(" | ")));
            }
            return sb.toString();
        }
    }
}
