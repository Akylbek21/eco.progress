package kz.eco.client.dto;

public record ClientSummary(
        String id,
        String name,
        String contact,
        long orders,
        String status
) {
}
