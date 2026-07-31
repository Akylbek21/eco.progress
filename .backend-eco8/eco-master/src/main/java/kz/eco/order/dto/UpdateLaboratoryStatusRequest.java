package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateLaboratoryStatusRequest(
        @NotBlank String laboratoryStatus,
        String comment
) {
}
