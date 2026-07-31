package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record AgreementResponseRequest(
        @NotBlank String action,
        String comment,
        String signedCms,
        String signerSubject
) {}
