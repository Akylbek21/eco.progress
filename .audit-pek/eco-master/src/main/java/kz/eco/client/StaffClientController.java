package kz.eco.client;

import jakarta.validation.Valid;
import kz.eco.client.dto.CreateClientRequest;
import kz.eco.client.dto.CreateClientResponse;
import kz.eco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff/clients")
@PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
public class StaffClientController {

    private final ClientService clientService;

    public StaffClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @PostMapping
    public ApiResponse<CreateClientResponse> createClient(@Valid @RequestBody CreateClientRequest request) {
        return ApiResponse.ok(clientService.createClient(request), "Клиент создан");
    }
}
