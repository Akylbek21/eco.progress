package kz.eco.protocol;

import kz.eco.common.exception.ConflictException;
import kz.eco.laboratory.Laboratory;
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

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Module spec item 4: LABORATORY_NOT_FOUND vs LABORATORY_INACTIVE must be distinguishable, and a
 *  laboratory returned by GET /api/laboratories (which only lists active ones) must always be
 *  accepted by POST /api/protocols/drafts - no drift between the two endpoints' notion of
 *  "usable laboratory". */
@SpringBootTest
@Transactional
class LaboratoryProtocolConsistencyTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private kz.eco.laboratory.LaboratoryService laboratoryService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void laboratoryFromListEndpoint_isAcceptedByCreateDraft() throws Exception {
        MvcResult listResult = mockMvc.perform(get("/api/laboratories"))
                .andExpect(status().isOk())
                .andReturn();
        Object firstLabId = com.jayway.jsonpath.JsonPath.read(
                listResult.getResponse().getContentAsString(), "$.data[0].id");
        assertEquals(String.valueOf(laboratoryId), String.valueOf(firstLabId));

        String today = LocalDate.now().toString();
        String draftBody = """
                {
                  "templateId": "%s",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "%s",
                  "laboratoryId": %s,
                  "executorId": %d
                }
                """.formatted(templateApiId, companyId, objectId, today, firstLabId, executorId);

        mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists());
    }

    @Test
    void inactiveLaboratory_returnsLaboratoryInactiveCode() throws Exception {
        Laboratory laboratory = laboratoryRepository.findById(laboratoryId).orElseThrow();
        laboratory.setActive(false);
        laboratoryRepository.save(laboratory);

        ConflictException ex = assertThrows(ConflictException.class,
                () -> laboratoryService.getActiveOrThrow(laboratoryId));
        assertEquals("LABORATORY_INACTIVE", ex.getCode());
    }

    @Test
    void missingLaboratory_stillReturnsLaboratoryNotFoundCode() {
        kz.eco.common.exception.NotFoundException ex = assertThrows(
                kz.eco.common.exception.NotFoundException.class,
                () -> laboratoryService.getActiveOrThrow(999999999L));
        assertEquals("LABORATORY_NOT_FOUND", ex.getCode());
    }

    @Test
    void inactiveLaboratory_rejectsCreateDraft() throws Exception {
        Laboratory laboratory = laboratoryRepository.findById(laboratoryId).orElseThrow();
        laboratory.setActive(false);
        laboratoryRepository.save(laboratory);

        String today = LocalDate.now().toString();
        String draftBody = """
                {
                  "templateId": "%s",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "%s",
                  "laboratoryId": %d,
                  "executorId": %d
                }
                """.formatted(templateApiId, companyId, objectId, today, laboratoryId, executorId);

        mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LABORATORY_INACTIVE"));
    }
}
