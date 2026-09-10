package kz.ecoprogress.documentflow.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record AccessRequestCreateRequest(
        @NotBlank @Size(max = 200) String contactName,
        @Size(max = 40) String phone,
        @Email @Size(max = 160) String email,
        @Size(max = 40) String planCode,
        @Positive Integer membersCount,
        @Size(max = 2000) String comment
) {
}
