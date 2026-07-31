package kz.eco.contract;

import kz.eco.auth.CurrentUser;
import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.common.ApiResponse;
import kz.eco.company.BusinessCompany;
import kz.eco.company.BusinessCompanyRepository;
import kz.eco.contract.dto.ContractResponse;
import kz.eco.order.Order;
import kz.eco.order.OrderRepository;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ContractController {

    private final ContractRepository contractRepository;
    private final ClientRepository clientRepository;
    private final OrderRepository orderRepository;
    private final BusinessCompanyRepository businessCompanyRepository;

    public ContractController(ContractRepository contractRepository,
                              ClientRepository clientRepository,
                              OrderRepository orderRepository,
                              BusinessCompanyRepository businessCompanyRepository) {
        this.contractRepository = contractRepository;
        this.clientRepository = clientRepository;
        this.orderRepository = orderRepository;
        this.businessCompanyRepository = businessCompanyRepository;
    }

    @GetMapping("/api/staff/contracts")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')")
    public ApiResponse<List<ContractResponse>> staffContracts() {
        return ApiResponse.ok(contractRepository.findAll().stream()
                .map(this::toResponse)
                .toList());
    }

    @GetMapping("/api/client/contracts")
    @PreAuthorize("hasRole('CLIENT')")
    public ApiResponse<List<ContractResponse>> clientContracts() {
        User user = CurrentUser.get();
        Client client = clientRepository.findByUserId(user.getId()).orElse(null);
        if (client == null) return ApiResponse.ok(List.of());
        return ApiResponse.ok(contractRepository.findByClientId(client.getId()).stream()
                .map(this::toResponse)
                .toList());
    }

    private ContractResponse toResponse(Contract c) {
        Client client = c.getClient();
        String companyName = client != null ? client.getCompanyName() : null;
        String bin = client != null ? client.getBinIin() : null;
        String ourName = "";
        if (c.getBusinessCompanyId() != null) {
            ourName = businessCompanyRepository.findById(c.getBusinessCompanyId())
                    .map(BusinessCompany::getName).orElse("");
        }
        String service = "";
        if (c.getOrderId() != null) {
            service = orderRepository.findById(c.getOrderId())
                    .map(Order::getServiceName).orElse("");
        }
        return ContractResponse.from(c, companyName, bin, ourName, service);
    }
}
