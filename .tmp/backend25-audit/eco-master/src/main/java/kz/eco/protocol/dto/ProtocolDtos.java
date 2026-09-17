package kz.eco.protocol.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import kz.eco.protocol.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ProtocolDtos {

    private ProtocolDtos() {
    }

    public record ProtocolTemplateResponse(
            Long id, String code, String name, String description,
            String formCode, boolean active, String createdAt, String updatedAt
    ) {
        public static ProtocolTemplateResponse from(ProtocolTemplate t) {
            return new ProtocolTemplateResponse(
                    t.getId(), t.getCode(), t.getName(), t.getDescription(),
                    t.getFormCode(), t.isActive(), iso(t.getCreatedAt()), iso(t.getUpdatedAt())
            );
        }
    }

    public record CreateProtocolRequest(
            @NotNull Long templateId,
            @NotNull LocalDate protocolDate,
            @NotBlank String organizationName,
            String organizationAddress,
            @NotBlank String objectName,
            String productName
    ) {
    }

    public record UpdateProtocolRequest(
            LocalDate protocolDate,
            Integer totalPages,
            String laboratoryName,
            String laboratoryAddress,
            String accreditationNumber,
            LocalDate accreditationValidFrom,
            LocalDate accreditationValidUntil,
            String directorName,
            String headOfLaboratoryName,
            String executorName,
            String organizationName,
            String organizationAddress,
            String productName,
            String objectName,
            String basisForTesting,
            String productNd,
            String samplingMethodNd,
            String testingMethodNd,
            LocalDate sampleDate,
            LocalDate testDate,
            String testPurpose,
            String environmentConditions
    ) {
    }

    public record ProtocolResponse(
            Long id, Long templateId, String templateCode, String protocolNumber,
            LocalDate protocolDate, Integer totalPages,
            String laboratoryName, String laboratoryAddress,
            String accreditationNumber, LocalDate accreditationValidFrom, LocalDate accreditationValidUntil,
            String directorName, String headOfLaboratoryName, String executorName,
            String organizationName, String organizationAddress,
            String productName, String objectName, String basisForTesting,
            String productNd, String samplingMethodNd, String testingMethodNd,
            LocalDate sampleDate, LocalDate testDate, String testPurpose, String environmentConditions,
            String status, Long createdBy, String createdAt, String updatedAt,
            Long approvedBy, String approvedAt, Long signedBy, String signedAt,
            String pdfFileId, String docxFileId, Long replacedProtocolId, String replacementReason
    ) {
        public static ProtocolResponse from(Protocol p, String templateCode) {
            return new ProtocolResponse(
                    p.getId(), p.getTemplateId(), templateCode, p.getProtocolNumber(),
                    p.getProtocolDate(), p.getTotalPages(),
                    p.getLaboratoryName(), p.getLaboratoryAddress(),
                    p.getAccreditationNumber(), p.getAccreditationValidFrom(), p.getAccreditationValidUntil(),
                    p.getDirectorName(), p.getHeadOfLaboratoryName(), p.getExecutorName(),
                    p.getOrganizationName(), p.getOrganizationAddress(),
                    p.getProductName(), p.getObjectName(), p.getBasisForTesting(),
                    p.getProductNd(), p.getSamplingMethodNd(), p.getTestingMethodNd(),
                    p.getSampleDate(), p.getTestDate(), p.getTestPurpose(), p.getEnvironmentConditions(),
                    p.getStatus().name(), p.getCreatedBy(), iso(p.getCreatedAt()), iso(p.getUpdatedAt()),
                    p.getApprovedBy(), iso(p.getApprovedAt()), p.getSignedBy(), iso(p.getSignedAt()),
                    p.getPdfFileId(), p.getDocxFileId(), p.getReplacedProtocolId(), p.getReplacementReason()
            );
        }
    }

    public record ProtocolResultRequest(
            Integer rowNumber,
            LocalDate sampleDate, String samplingPlace, String pollutionSourceNumber,
            String objectName, String sampleName, String indicatorName, String unit,
            String testingMethodNd, String samplingMethodNd,
            BigDecimal normativeValue, BigDecimal minValue, BigDecimal maxValue, BigDecimal resultValue,
            String note,
            BigDecimal temperatureC, BigDecimal flowSpeedMs, BigDecimal gasAirVolumeNm3s, BigDecimal ductAreaM2,
            BigDecimal pdvMgM3, BigDecimal pdvGs, BigDecimal resultMgM3, BigDecimal resultGs,
            BigDecimal pdsMgDm3, BigDecimal resultMgDm3, BigDecimal pdkMgM3, BigDecimal pdkOrBackground,
            String vehicleModel, String plateNumber,
            BigDecimal coPercent, BigDecimal chPpm, BigDecimal smokeK, BigDecimal smokeNPercent,
            String measurementPlace, String roomOrWorkplace,
            Long deviceId, LocalDate verificationDate, LocalDate verificationValidUntil
    ) {
    }

    public record ProtocolResultResponse(
            Long id, Long protocolId, Integer rowNumber,
            LocalDate sampleDate, String samplingPlace, String pollutionSourceNumber,
            String objectName, String sampleName, String indicatorName, String unit,
            String testingMethodNd, String samplingMethodNd,
            Long normativeId, String normativeType, BigDecimal normativeValue,
            BigDecimal minValue, BigDecimal maxValue, BigDecimal resultValue,
            String comparisonType, String internalStatus, String note,
            BigDecimal temperatureC, BigDecimal flowSpeedMs, BigDecimal gasAirVolumeNm3s, BigDecimal ductAreaM2,
            BigDecimal pdvMgM3, BigDecimal pdvGs, BigDecimal resultMgM3, BigDecimal resultGs,
            BigDecimal pdsMgDm3, BigDecimal resultMgDm3, BigDecimal pdkMgM3, BigDecimal pdkOrBackground,
            String vehicleModel, String plateNumber,
            BigDecimal coPercent, BigDecimal chPpm, BigDecimal smokeK, BigDecimal smokeNPercent,
            String measurementPlace, String roomOrWorkplace,
            Long deviceId, LocalDate verificationDate, LocalDate verificationValidUntil
    ) {
        public static ProtocolResultResponse from(ProtocolResult r) {
            return new ProtocolResultResponse(
                    r.getId(), r.getProtocolId(), r.getRowNumber(),
                    r.getSampleDate(), r.getSamplingPlace(), r.getPollutionSourceNumber(),
                    r.getObjectName(), r.getSampleName(), r.getIndicatorName(), r.getUnit(),
                    r.getTestingMethodNd(), r.getSamplingMethodNd(),
                    r.getNormativeId(), enumName(r.getNormativeType()), r.getNormativeValue(),
                    r.getMinValue(), r.getMaxValue(), r.getResultValue(),
                    enumName(r.getComparisonType()), enumName(r.getInternalStatus()), r.getNote(),
                    r.getTemperatureC(), r.getFlowSpeedMs(), r.getGasAirVolumeNm3s(), r.getDuctAreaM2(),
                    r.getPdvMgM3(), r.getPdvGs(), r.getResultMgM3(), r.getResultGs(),
                    r.getPdsMgDm3(), r.getResultMgDm3(), r.getPdkMgM3(), r.getPdkOrBackground(),
                    r.getVehicleModel(), r.getPlateNumber(),
                    r.getCoPercent(), r.getChPpm(), r.getSmokeK(), r.getSmokeNPercent(),
                    r.getMeasurementPlace(), r.getRoomOrWorkplace(),
                    r.getDeviceId(), r.getVerificationDate(), r.getVerificationValidUntil()
            );
        }
    }

    public record NormativeCheckResponse(
            List<ProtocolResultResponse> results,
            List<String> warnings
    ) {
    }

    public record ReplaceProtocolRequest(@NotBlank String replacementReason) {
    }

    public record CancelProtocolRequest(String comment) {
    }

    public record SignProtocolRequest(String cmsSignatureBase64) {
    }

    public record NormativeReferenceRequest(
            @NotBlank String templateCode,
            String objectType,
            @NotBlank String indicatorName,
            String unit,
            String normativeType,
            BigDecimal normativeValue,
            BigDecimal minValue,
            BigDecimal maxValue,
            String comparisonType,
            String normativeDocument,
            String testingMethodNd,
            String samplingMethodNd,
            LocalDate activeFrom,
            LocalDate activeTo,
            Boolean active
    ) {
    }

    public record NormativeReferenceResponse(
            Long id, String templateCode, String objectType, String indicatorName, String unit,
            String normativeType, BigDecimal normativeValue, BigDecimal minValue, BigDecimal maxValue,
            String comparisonType, String normativeDocument, String testingMethodNd, String samplingMethodNd,
            LocalDate activeFrom, LocalDate activeTo, boolean active,
            String createdAt, String updatedAt
    ) {
        public static NormativeReferenceResponse from(NormativeReference n) {
            return new NormativeReferenceResponse(
                    n.getId(), n.getTemplateCode(), n.getObjectType(), n.getIndicatorName(), n.getUnit(),
                    enumName(n.getNormativeType()), n.getNormativeValue(), n.getMinValue(), n.getMaxValue(),
                    enumName(n.getComparisonType()), n.getNormativeDocument(), n.getTestingMethodNd(), n.getSamplingMethodNd(),
                    n.getActiveFrom(), n.getActiveTo(), n.isActive(),
                    iso(n.getCreatedAt()), iso(n.getUpdatedAt())
            );
        }
    }

    public record MeasurementDeviceRequest(
            @NotBlank String name,
            String model, String serialNumber, String verificationCertificateNumber,
            LocalDate verificationDate, LocalDate verificationValidUntil,
            String units, String status
    ) {
    }

    public record MeasurementDeviceResponse(
            Long id, String name, String model, String serialNumber,
            String verificationCertificateNumber, LocalDate verificationDate, LocalDate verificationValidUntil,
            String units, String status, String createdAt, String updatedAt
    ) {
        public static MeasurementDeviceResponse from(MeasurementDevice d) {
            return new MeasurementDeviceResponse(
                    d.getId(), d.getName(), d.getModel(), d.getSerialNumber(),
                    d.getVerificationCertificateNumber(), d.getVerificationDate(), d.getVerificationValidUntil(),
                    d.getUnits(), d.getStatus().name(), iso(d.getCreatedAt()), iso(d.getUpdatedAt())
            );
        }
    }

    public record ImportExcelResponse(int importedRows, List<String> warnings) {
    }

    private static String iso(LocalDateTime value) {
        return value != null ? value.toString() : null;
    }

    private static String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }
}
