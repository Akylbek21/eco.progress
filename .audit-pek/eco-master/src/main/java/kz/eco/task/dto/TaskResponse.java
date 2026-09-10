package kz.eco.task.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.task.StaffTask;
import kz.eco.task.TaskStatus;

public record TaskResponse(
        Long id,
        String title,
        String description,
        String orderId,
        Long assigneeId,
        String assigneeName,
        String dueDate,
        TaskStatus status,
        String createdAt,
        String updatedAt
) {
    public static TaskResponse from(StaffTask t) {
        return new TaskResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                t.getOrderId(),
                t.getAssignee() != null ? t.getAssignee().getId() : null,
                t.getAssignee() != null ? t.getAssignee().getName() : null,
                t.getDueDate() != null ? t.getDueDate().toString() : null,
                t.getStatus(),
                RuDateFormatter.formatDateTime(t.getCreatedAt()),
                RuDateFormatter.formatDateTime(t.getUpdatedAt())
        );
    }
}
