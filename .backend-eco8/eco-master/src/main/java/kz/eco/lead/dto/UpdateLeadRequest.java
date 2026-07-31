package kz.eco.lead.dto;

import kz.eco.lead.LeadStatus;

public record UpdateLeadRequest(
        LeadStatus status,
        Long assignedManagerId
) {}
