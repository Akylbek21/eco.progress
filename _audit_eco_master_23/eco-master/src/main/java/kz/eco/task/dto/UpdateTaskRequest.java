package kz.eco.task.dto;

import kz.eco.task.TaskStatus;
import java.time.LocalDate;

public record UpdateTaskRequest(
        String title,
        String description,
        String orderId,
        Long assigneeId,
        LocalDate dueDate,
        TaskStatus status
) {}
