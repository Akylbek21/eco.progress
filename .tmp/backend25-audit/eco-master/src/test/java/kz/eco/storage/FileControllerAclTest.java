package kz.eco.storage;

import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.order.Order;
import kz.eco.order.OrderDocument;
import kz.eco.order.OrderDocumentRepository;
import kz.eco.order.OrderRepository;
import kz.eco.order.OrderStatus;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression coverage for the P0 fixed in FileController: a bare GET /api/files/documents/{fileId}
 * must no longer let any authenticated user download any file regardless of ownership.
 */
@SpringBootTest
@Transactional
class FileControllerAclTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private FileStorageService fileStorageService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ClientRepository clientRepository;
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private OrderDocumentRepository orderDocumentRepository;
    @Autowired
    private ProtocolRepository protocolRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private User createClientUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Client " + email);
        user.setRole(UserRole.CLIENT);
        user.setType(ClientType.company);
        userRepository.save(user);

        Client client = new Client();
        client.setUser(user);
        client.setClientType(ClientType.company);
        client.setCompanyName("Company for " + email);
        client.setEmail(email);
        clientRepository.save(client);
        return user;
    }

    private Order createOrderForClient(Client client) {
        Order order = new Order();
        order.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        order.setClient(client);
        order.setServiceName("Test service");
        order.setStatus(OrderStatus.CONSULTATION);
        return orderRepository.save(order);
    }

    /** Builds an Authentication token to attach to a single MockMvc request via the
     *  `authentication(...)` RequestPostProcessor - more reliable than pre-setting
     *  SecurityContextHolder when a test needs to switch between users across requests, since
     *  Spring Security's context-loading filter resets the holder at the start of each request. */
    private Authentication authOf(User user) {
        return new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

    @Test
    void orderDocument_wrongClient_isDenied_andOwningClientSucceeds() throws Exception {
        User userA = createClientUser("client-a-" + System.nanoTime() + "@test.kz");
        Client clientA = clientRepository.findByUserId(userA.getId()).orElseThrow();
        Order orderA = createOrderForClient(clientA);

        User userB = createClientUser("client-b-" + System.nanoTime() + "@test.kz");

        StoredFileMetadata stored = fileStorageService.storeBytes(
                "secret contract content".getBytes(StandardCharsets.UTF_8),
                "contract.pdf", "application/pdf", orderA.getId(), userA.getEmail());

        OrderDocument doc = new OrderDocument();
        doc.setOrder(orderA);
        doc.setName("Contract");
        doc.setFileName("contract.pdf");
        doc.setFileUrl("/api/files/documents/" + stored.fileId());
        doc.setUploadedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        orderDocumentRepository.save(doc);

        // Client B has no relationship to order A's company - must be denied.
        mockMvc.perform(get("/api/files/documents/" + stored.fileId()).with(authentication(authOf(userB))))
                .andExpect(status().isUnauthorized());

        // Client A owns the order - must succeed and return the real content.
        var result = mockMvc.perform(get("/api/files/documents/" + stored.fileId()).with(authentication(authOf(userA))))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals("secret contract content", result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    void protocolDocument_requiresLabProtocolRole_notJustAnyAuthenticatedUser() throws Exception {
        Protocol protocol = new Protocol();
        protocol.setTemplateId(1L);
        protocol.setCreatedBy(1L);
        protocol.setProtocolNumber("TEST-ACL-" + System.nanoTime());
        protocol.setStatus(ProtocolStatus.DRAFT);
        protocol.setProtocolDate(LocalDate.now());

        StoredFileMetadata stored = fileStorageService.storeBytes(
                "protocol pdf bytes".getBytes(StandardCharsets.UTF_8),
                "protocol.pdf", "application/pdf", "protocol-pending", "system");
        protocol.setPdfFileId(stored.fileId());
        protocolRepository.save(protocol);

        // A CLIENT account has no business reading laboratory protocol files directly.
        User client = createClientUser("client-proto-" + System.nanoTime() + "@test.kz");
        mockMvc.perform(get("/api/files/documents/" + stored.fileId()).with(authentication(authOf(client))))
                .andExpect(status().isForbidden());

        // A LABORATORY staff account is the same role ProtocolController already trusts
        // with protocol downloads.
        User labUser = new User();
        labUser.setEmail("lab-proto-" + System.nanoTime() + "@test.kz");
        labUser.setPasswordHash(passwordEncoder.encode("demo123"));
        labUser.setName("Lab tester");
        labUser.setRole(UserRole.LABORATORY);
        labUser.setType(ClientType.staff);
        userRepository.save(labUser);

        var result = mockMvc.perform(get("/api/files/documents/" + stored.fileId()).with(authentication(authOf(labUser))))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals("protocol pdf bytes", result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
