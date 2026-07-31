package kz.eco.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import kz.eco.user.ClientType;

public record RegisterRequest(
        @NotBlank String type,
        String name,
        String contactPerson,
        String position,
        String phone,
        @NotBlank @Email String email,
        @NotBlank String password,
        String city,
        String companyName,
        String bin,
        String organizationType,
        String legalAddress
) {
    public ClientType clientType() {
        return "company".equalsIgnoreCase(type) ? ClientType.company : ClientType.individual;
    }
}
