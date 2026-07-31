package kz.eco.client;

import kz.eco.client.dto.ClientSummary;
import kz.eco.common.ApiResponse;
import kz.eco.order.Order;
import kz.eco.order.OrderRepository;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/clients")
@PreAuthorize(SecurityExpressions.STAFF)
public class ClientController {

    private final ClientRepository clientRepository;
    private final OrderRepository orderRepository;

    public ClientController(ClientRepository clientRepository, OrderRepository orderRepository) {
        this.clientRepository = clientRepository;
        this.orderRepository = orderRepository;
    }

    @GetMapping
    public ApiResponse<List<ClientSummary>> list() {
        List<Client> clients = clientRepository.findAll();
        List<ClientSummary> result = new ArrayList<>();
        for (Client client : clients) {
            List<Order> orders = orderRepository.findByClientIdOrderByCreatedAtDesc(client.getId());
            String name = client.getCompanyName() != null && !client.getCompanyName().isBlank()
                    ? client.getCompanyName()
                    : client.getContactPerson();
            String status = orders.isEmpty() ? "Новый" : "Активный";
            result.add(new ClientSummary(
                    "client-" + client.getId(),
                    name,
                    client.getContactPerson(),
                    orders.size(),
                    status
            ));
        }
        return ApiResponse.ok(result);
    }
}
