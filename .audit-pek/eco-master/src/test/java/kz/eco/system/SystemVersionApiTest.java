package kz.eco.system;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/system/version: covers the auth gate (STAFF-role required, LABORATORY qualifies;
 * unauthenticated is rejected) and that the endpoint responds even when BuildProperties isn't on
 * the classpath (the normal case under `mvn test`, since build-info.properties is only generated
 * at the "prepare-package" phase) - see SystemVersionController's ObjectProvider note.
 */
@SpringBootTest
@Transactional
class SystemVersionApiTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void versionEndpointRespondsForStaffRole() throws Exception {
        mockMvc.perform(get("/api/system/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").exists())
                .andExpect(jsonPath("$.data.gitCommit").exists())
                .andExpect(jsonPath("$.data.activeProfiles").isArray());
    }

    @Test
    void versionEndpointRejectsUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/system/version"))
                .andExpect(status().is4xxClientError());
    }
}
