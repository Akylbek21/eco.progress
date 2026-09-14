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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Task item 6/12: POST /api/protocols/drafts previously had no Idempotency-Key support at all
 * (only quick-create did), so a client retry (double-click, timeout-triggered resend) could
 * create two drafts for one user action. This locks in the fix - same wiring/pattern as
 * ProtocolQuickCreateApiTest would cover for quick-create, applied to the drafts endpoint.
 */
@SpringBootTest
@Transactional
class ProtocolDraftIdempotencyTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void createDraft_sameIdempotencyKey_doesNotCreateDuplicate() throws Exception {
        String body = "{\"templateId\":\"" + templateApiId + "\"}";
        String key = "draft-retry-" + System.nanoTime();

        MvcResult first = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String firstId = JsonPath.read(first.getResponse().getContentAsString(), "$.data.id");

        MvcResult second = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String secondId = JsonPath.read(second.getResponse().getContentAsString(), "$.data.id");

        assertEquals(firstId, secondId, "retrying draft-create with the same Idempotency-Key must return the same draft");
    }

    @Test
    void createDraft_differentIdempotencyKey_createsSeparateDrafts() throws Exception {
        String body = "{\"templateId\":\"" + templateApiId + "\"}";

        MvcResult first = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", "draft-a-" + System.nanoTime())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String firstId = JsonPath.read(first.getResponse().getContentAsString(), "$.data.id");

        MvcResult second = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", "draft-b-" + System.nanoTime())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String secondId = JsonPath.read(second.getResponse().getContentAsString(), "$.data.id");

        assertNotEquals(firstId, secondId);
    }
}
