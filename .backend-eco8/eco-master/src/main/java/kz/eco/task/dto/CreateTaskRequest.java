package kz.eco.task.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CreateTaskRequest(
        @NotBlank String title,
        String description,
        String orderId,
        Long assigneeId,
        LocalDate dueDate
) {}
