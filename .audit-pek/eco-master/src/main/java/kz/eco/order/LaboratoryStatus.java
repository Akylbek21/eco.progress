package kz.eco.order;

public enum LaboratoryStatus {
    not_assigned,
    waiting_samples,
    samples_received,
    analysis_in_progress,
    result_ready,
    // legacy value in existing rows; new API writes result_ready
    done
}
