package kz.eco.lead.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.lead.Lead;
import kz.eco.lead.LeadStatus;

public record LeadResponse(
        Long id,
        String name,
        String phone,
        String city,
        String serviceType,
        String comment,
        String source,
        LeadStatus status,
        String assignedManagerName,
        String createdAt
) {
    public static LeadResponse from(Lead l) {
        return new LeadResponse(
                l.getId(),
                l.getName(),
                l.getPhone(),
                l.getCity(),
                l.getServiceId(),
                l.getMessage(),
                l.getSource(),
                l.getStatus(),
                l.getAssignedManager() != null ? l.getAssignedManager().getName() : null,
                RuDateFormatter.formatDateTime(l.getCreatedAt())
        );
    }
}
