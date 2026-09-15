package kz.eco.lead;

import jakarta.validation.Valid;
import kz.eco.common.ApiResponse;
import kz.eco.lead.dto.CreateLeadRequest;
import kz.eco.lead.dto.LeadResponse;
import kz.eco.lead.dto.UpdateLeadRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @PostMapping("/api/leads")
    public ApiResponse<LeadResponse> create(@Valid @RequestBody CreateLeadRequest request) {
        return ApiResponse.ok(leadService.create(request), "Заявка отправлена");
    }

    @GetMapping("/api/staff/leads")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')")
    public ApiResponse<List<LeadResponse>> list() {
        return ApiResponse.ok(leadService.findAll());
    }

    @PatchMapping("/api/staff/leads/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')")
    public ApiResponse<LeadResponse> update(@PathVariable Long id,
                                            @Valid @RequestBody UpdateLeadRequest request) {
        return ApiResponse.ok(leadService.update(id, request), "Лид обновлён");
    }
}
