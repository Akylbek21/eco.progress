package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.LaboratoryMeasurementAgreement;
import kz.eco.order.MeasurementAgreementStatus;

public record MeasurementAgreementResponse(
        Long id,
        MeasurementAgreementStatus status,
        String date,
        String time,
        String address,
        String company,
        String contact,
        String scope,
        String staffComment,
        String clientComment,
        String rescheduleDate,
        String rescheduleTime,
        String rescheduleAddress,
        String rescheduleComment,
        String sentAt,
        String respondedAt,
        String createdAt,
        String updatedAt
) {
    public static MeasurementAgreementResponse from(LaboratoryMeasurementAgreement a) {
        return new MeasurementAgreementResponse(
                a.getId(),
                a.getStatus(),
                a.getDate(),
                a.getTime(),
                a.getAddress(),
                a.getCompany(),
                a.getContact(),
                a.getScope(),
                a.getStaffComment(),
                a.getClientComment(),
                a.getRescheduleDate(),
                a.getRescheduleTime(),
                a.getRescheduleAddress(),
                a.getRescheduleComment(),
                RuDateFormatter.formatDateTime(a.getSentAt()),
                RuDateFormatter.formatDateTime(a.getRespondedAt()),
                RuDateFormatter.formatDateTime(a.getCreatedAt()),
                RuDateFormatter.formatDateTime(a.getUpdatedAt())
        );
    }
}
