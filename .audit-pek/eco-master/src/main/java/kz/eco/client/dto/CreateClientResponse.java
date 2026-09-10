package kz.eco.client.dto;

import kz.eco.client.Client;

public record CreateClientResponse(
        Long id,
        String companyName,
        String binIin,
        String email,
        String phone,
        String contactPerson,
        String legalAddress,
        String clientType,
        String tempPassword
) {
    public static CreateClientResponse from(Client client, String tempPassword) {
        return new CreateClientResponse(
                client.getId(),
                client.getCompanyName(),
                client.getBinIin(),
                client.getEmail(),
                client.getPhone(),
                client.getContactPerson(),
                client.getLegalAddress(),
                client.getClientType().name(),
                tempPassword
        );
    }
}
