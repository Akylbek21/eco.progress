package kz.eco.client.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateClientRequest(
        String companyName,
        String binIin,
        @NotBlank String email,
        String phone,
        String contactPerson,
        String legalAddress,
        String clientType
) {}
