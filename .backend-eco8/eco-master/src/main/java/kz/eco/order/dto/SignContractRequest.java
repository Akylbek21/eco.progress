package kz.eco.order.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record SignContractRequest(
        @JsonAlias("provider") String signatureProvider,
        String signedCms,
        String signerSubject,
        Long documentId,
        String signedAt
) {}
