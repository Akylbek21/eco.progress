package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record DocumentRespondRequest(
        @NotBlank String action,
        String signedCms,
        String signerSubject,
        String comment
) {}
