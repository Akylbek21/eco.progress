package kz.eco.protocol;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolCreateApiTest extends ProtocolApiTestSupport {

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
    void create_withValidData_returnsIdAndNumber() throws Exception {
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.protocolNumber").exists())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.message").value("Протокол создан"));
    }

    @Test
    void create_withoutToken_returns401() throws Exception {
        clearAuthentication();
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void create_asClient_returns403() throws Exception {
        User client = new User();
        client.setEmail("client-api-" + System.nanoTime() + "@ecoprogress.kz");
        client.setPasswordHash(passwordEncoder.encode("demo123"));
        client.setName("Client");
        client.setRole(UserRole.CLIENT);
        client.setType(ClientType.individual);
        userRepository.save(client);
        authenticate(client);
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void create_asLaboratory_returns200() throws Exception {
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
