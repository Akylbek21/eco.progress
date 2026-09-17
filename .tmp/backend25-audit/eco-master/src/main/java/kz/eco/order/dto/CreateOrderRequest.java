package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateOrderRequest(
        @NotBlank String serviceId,
        String contactPerson,
        String phone,
        String city,
        String objectAddress,
        String comment,
        String urgency,
        String contractType,
        String companyName,
        String bin,
        String email,
        String signatureProvider,
        String paymentMethod,
        String fileName
) {}
