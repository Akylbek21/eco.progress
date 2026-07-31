package kz.eco.order;

public enum WorkStatus {
    planned,
    waiting_client_data,
    waiting_payment,
    ready_to_start,
    in_progress,
    blocked_by_debt,
    completed
}
