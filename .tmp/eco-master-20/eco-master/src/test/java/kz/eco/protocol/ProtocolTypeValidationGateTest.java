package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the gap closed in this pass: previously validateReadyForApproval only ran the
 * structural (non-blank field) checks and never consulted {@link kz.eco.protocol.validation.ProtocolValidationPolicyRegistry},
 * so a lighting protocol assembled via the plain create+addResult path (not quick-create) could
 * reach READY_FOR_APPROVAL/sign with no roomType/workplaceType/lightingType declared. Also covers
 * the structured-column round trip for the previously-silently-dropped header-level condition
 * fields (season/workCategory/roomType/workplaceType/lightingType/... - see
 * ProtocolEnvironmentConditions).
 */
@SpringBootTest
@Transactional
class ProtocolTypeValidationGateTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        ensureLightingTemplate();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private void ensureLightingTemplate() {
        if (templateRepository.findByCode("LIGHTING").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("LIGHTING");
            template.setName("Освещённость");
            template.setDescription("Освещённость");
            template.setFormCode("PHF");
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    private String createLightingProtocolWithOneResult() throws Exception {
        templateApiId = "lighting";
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        String protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        addResultViaDraftBatch(mockMvc, protocolId, 0);
        return protocolId;
    }

    @Test
    void readyForApproval_blocksLightingProtocol_missingTypeConditions() throws Exception {
        String protocolId = createLightingProtocolWithOneResult();
        long version = ((Number) JsonPath.read(
                mockMvc.perform(get("/api/protocols/" + protocolId)).andReturn().getResponse().getContentAsString(),
                "$.data.version")).longValue();

        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + version + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].code",
                        org.hamcrest.Matchers.hasItem("LIGHTING_ROOM_TYPE_REQUIRED")));
    }

    @Test
    void readyForApproval_succeeds_onceLightingConditionsSupplied_andRoundTripsThroughResponse() throws Exception {
        String protocolId = createLightingProtocolWithOneResult();
        long v0 = ((Number) JsonPath.read(
                mockMvc.perform(get("/api/protocols/" + protocolId)).andReturn().getResponse().getContentAsString(),
                "$.data.version")).longValue();

        // readyForApproval also needs testingMethodDocument (structural check, unrelated to the
        // type-policy gate under test here) - same fixture step ProtocolReasonAliasApiTest uses.
        MvcResult afterTestingMethod = mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testing\":{\"testingMethodDocument\":\"МУК 4.1.2468-09\"}, \"version\": " + v0 + "}"))
                .andExpect(status().isOk())
                .andReturn();
        long v1 = ((Number) JsonPath.read(afterTestingMethod.getResponse().getContentAsString(), "$.data.version")).longValue();

        String patchBody = """
                {
                  "environment": {
                    "conditions": {
                      "roomType": "Производственное помещение",
                      "workplaceType": "Постоянное рабочее место",
                      "lightingType": "Искусственное"
                    }
                  },
                  "version": %d
                }
                """.formatted(v1);
        MvcResult afterConditions = mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.environment.conditions.roomType").value("Производственное помещение"))
                .andExpect(jsonPath("$.data.environment.conditions.workplaceType").value("Постоянное рабочее место"))
                .andExpect(jsonPath("$.data.environment.conditions.lightingType").value("Искусственное"))
                .andReturn();
        long v2 = ((Number) JsonPath.read(afterConditions.getResponse().getContentAsString(), "$.data.version")).longValue();

        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v2 + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_APPROVAL"));

        MvcResult reloaded = mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andReturn();
        String body = reloaded.getResponse().getContentAsString();
        assertTrue(body.contains("\"roomType\":\"Производственное помещение\""),
                "condition fields must round-trip through the new structured columns, not just at write time");
    }
}
