package kz.eco.order.dto;

import java.time.LocalDate;

public record SendDocumentToClientRequest(
        boolean needsSignature,
        boolean needsClientResponse,
        String staffComment,
        LocalDate dueDate
) {}
