package kz.eco.order.dto;

public record SaveMeasurementAgreementRequest(
        String date,
        String time,
        String address,
        String company,
        String contact,
        String scope
) {}
