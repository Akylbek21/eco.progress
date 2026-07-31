package kz.eco.task.dto;

public record CalendarEventResponse(
        String id,
        String type,
        String title,
        String date,
        String orderId,
        String status
) {}
