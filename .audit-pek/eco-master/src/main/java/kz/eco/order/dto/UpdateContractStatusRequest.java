package kz.eco.order.dto;

import jakarta.validation.constraints.NotNull;
import kz.eco.order.CrmContractStatus;

public record UpdateContractStatusRequest(@NotNull CrmContractStatus crmContractStatus) {}
