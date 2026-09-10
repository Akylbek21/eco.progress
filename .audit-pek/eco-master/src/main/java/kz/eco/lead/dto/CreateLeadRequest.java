package kz.eco.lead.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateLeadRequest(
        @NotBlank String name,
        @NotBlank String phone,
        String city,
        String serviceType,
        String comment,
        String source,
        String email,
        String companyName,
        String serviceId,
        String message
) {}
