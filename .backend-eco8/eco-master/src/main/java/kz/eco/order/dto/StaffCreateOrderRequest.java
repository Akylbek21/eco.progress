package kz.eco.order.dto;

import jakarta.validation.constraints.NotNull;

public record StaffCreateOrderRequest(
        @NotNull Long clientId,
        String serviceId,
        String serviceName,
        String businessCompanyId,
        String contractType,
        String urgency,
        String comment,
        String contactPerson,
        String phone,
        String city
) {}
