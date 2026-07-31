package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolApiDtos;

import java.time.LocalDate;

public final class ProtocolCreateRequestFactory {

    private ProtocolCreateRequestFactory() {
    }

    public static ProtocolApiDtos.CreateProtocolRequest minimal(
            String templateId,
            Long companyId,
            Long objectId,
            Long laboratoryId,
            Long executorId) {
        String today = LocalDate.now().toString();
        return new ProtocolApiDtos.CreateProtocolRequest(
                templateId,
                companyId,
                objectId,
                null,
                today,
                today,
                today,
                today,
                today,
                today,
                "Контроль",
                "Контроль",
                "Контроль",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                laboratoryId,
                executorId,
                null
        );
    }
}
