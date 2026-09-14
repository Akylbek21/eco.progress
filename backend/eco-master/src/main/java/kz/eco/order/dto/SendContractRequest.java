package kz.eco.order.dto;

import java.math.BigDecimal;

public record SendContractRequest(
        BigDecimal amount,
        String paymentMethod,
        String signatureProvider,
        String contractFileName
) {}
