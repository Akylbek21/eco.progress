package kz.eco.protocol;

import kz.eco.order.Order;
import kz.eco.order.OrderRepository;
import kz.eco.order.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Task item 9 (enforceable subset - see implementation report for why full orderServiceItemId
 * line-item FK validation is out of scope): orderId must reference an existing, non-terminal
 * Order, and when that Order's businessCompanyId parses as a Company id, it must match the
 * protocol's companyId. The existence+status check already existed (ProtocolService.linkOrder);
 * this covers the company-consistency check added in this pass.
 */
@SpringBootTest
@Transactional
class ProtocolOrderLinkageValidationTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private OrderRepository orderRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private Order createOrder(String businessCompanyId) {
        Order order = new Order();
        order.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        order.setStatus(OrderStatus.CONSULTATION);
        order.setServiceName("Test service");
        order.setBusinessCompanyId(businessCompanyId);
        return orderRepository.save(order);
    }

    private String createProtocolJsonWithOrder(String orderId) {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "%s",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "%s",
                  "sampleDate": "%s",
                  "testingStartDate": "%s",
                  "testingEndDate": "%s",
                  "measurementPlace": "СЗЗ, точка №1",
                  "laboratoryId": %d,
                  "executorId": %d,
                  "orderId": "%s"
                }
                """.formatted(templateApiId, companyId, objectId, today, today, today, today,
                laboratoryId, executorId, orderId);
    }

    @Test
    void create_rejectsOrder_belongingToDifferentCompany() throws Exception {
        Order order = createOrder(String.valueOf(companyId + 999999L));

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithOrder(order.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ORDER_COMPANY_MISMATCH"));
    }

    @Test
    void create_acceptsOrder_belongingToSameCompany() throws Exception {
        Order order = createOrder(String.valueOf(companyId));

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithOrder(order.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderId").value(order.getId()));
    }

    @Test
    void create_rejectsUnknownOrderId() throws Exception {
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithOrder("no-such-order-id")))
                .andExpect(status().isNotFound());
    }
}
