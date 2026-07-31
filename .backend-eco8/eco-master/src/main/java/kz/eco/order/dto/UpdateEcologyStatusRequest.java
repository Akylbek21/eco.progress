package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateEcologyStatusRequest(
        @NotBlank String ecologyStatus,
        String comment
) {
}
