package kz.eco.protocol;

import kz.eco.auth.CurrentUser;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.normative.NormativeApiContract;
import kz.eco.normative.NormativeRecordBuilder;
import kz.eco.normative.NormativeTypeLabels;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class ProtocolApiMapper {

    private final ObjectMapper objectMapper;
    private final ProtocolAuditLogRepository auditLogRepository;
    private final ProtocolPermissionService permissionService;
    private final ProtocolSignatureRepository signatureRepository;
    private final ProtocolSigningProperties signingProperties;

    ProtocolApiMapper(ObjectMapper objectMapper, ProtocolAuditLogRepository auditLogRepository,
                      ProtocolPermissionService permissionService, ProtocolSignatureRepository signatureRepository,
                      ProtocolSigningProperties signingProperties) {
        this.objectMapper = objectMapper;
        this.auditLogRepository = auditLogRepository;
        this.permissionService = permissionService;
        this.signatureRepository = signatureRepository;
        this.signingProperties = signingProperties;
    }

    ProtocolApiDtos.ProtocolTemplateResponse toTemplate(ProtocolTemplate template) {
        ProtocolTemplateCode code = ProtocolTemplateCode.fromDbCode(template.getCode());
        String apiId = code != null ? code.toApiId() : template.getCode().toLowerCase();
        return ProtocolApiDtos.ProtocolTemplateResponse.basic(apiId, template.getName(), template.getDescription());
    }

    ProtocolApiDtos.ProtocolResponse toProtocol(Protocol protocol, ProtocolTemplate template, List<ProtocolResult> results) {
        return toProtocol(protocol, template, results, null);
    }

    ProtocolApiDtos.ProtocolResponse toProtocol(Protocol protocol, ProtocolTemplate template,
                                                List<ProtocolResult> results, ProtocolEnvironmentConditions env) {
        ProtocolTemplateCode templateCode = ProtocolTemplateCode.fromDbCode(template.getCode());
        String apiTemplateId = templateCode != null ? templateCode.toApiId() : template.getCode().toLowerCase();
        ProtocolApiDtos.CompanySnapshotData company = toCompany(protocol);
        List<ProtocolApiDtos.MeasurementDeviceData> devices = readInstruments(protocol.getInstrumentsJson());
        List<Map<String, Object>> resultRows = results.stream()
                .map(ProtocolResultResponseMapper::toResponse)
                .toList();
        String number = protocol.getProtocolNumber();
        List<ProtocolSignature> signatureRows =
                signatureRepository.findAllByProtocolIdAndProtocolVersionOrderBySignedAtAsc(protocol.getId(), protocol.getVersion());
        List<ProtocolApiDtos.ProtocolSignatureData> signatures = signatureRows.stream()
                .map(s -> new ProtocolApiDtos.ProtocolSignatureData(
                        String.valueOf(s.getId()), s.getUserId(), s.getSignerFullName(), s.getSignerPosition(),
                        s.getSignedAt() != null ? s.getSignedAt().toString() : null))
                .toList();
        kz.eco.user.User currentUser = CurrentUser.getOrNull();
        boolean signedByCurrentUser = currentUser != null
                && signatureRows.stream().anyMatch(s -> s.getUserId().equals(currentUser.getId()));
        return new ProtocolApiDtos.ProtocolResponse(
                String.valueOf(protocol.getId()),
                number,
                number,
                apiTemplateId,
                template.getName(),
                protocol.getStatus().name(),
                formatDate(protocol.getProtocolDate()),
                protocol.getCompanyId(),
                protocol.getObjectId(),
                company,
                company,
                protocol.getSubtype(),
                protocol.getFormCode(),
                protocol.getAppendixNumber(),
                protocol.getExecutorName(),
                protocol.getHeadOfLaboratoryName(),
                formatDateTime(protocol.getApprovedAt()),
                formatDateTime(protocol.getSignedAt()),
                formatDate(protocol.getSampleDate()),
                nullToEmpty(protocol.getMeasurementTime()),
                nullToEmpty(protocol.getSamplingLocationSnapshot()),
                nullToEmpty(protocol.getSourceNumber()),
                toLaboratory(protocol),
                toOrganization(protocol),
                toTesting(protocol),
                toEnvironment(env),
                resultRows,
                devices,
                devices,
                loadHistory(protocol.getId()),
                protocol.getExplanatoryNote(),
                protocol.getComplianceStatus(),
                protocol.getComplianceDocument(),
                formatDate(protocol.getTestingStartDate()),
                formatDate(protocol.getTestingEndDate()),
                formatDateTime(protocol.getCreatedAt()),
                formatDateTime(protocol.getUpdatedAt()),
                protocol.getReplacedByProtocolId() != null ? String.valueOf(protocol.getReplacedByProtocolId()) : null,
                protocol.getReplacedProtocolId() != null ? String.valueOf(protocol.getReplacedProtocolId()) : null,
                protocol.getDocxFileId(),
                protocol.getPdfFileId(),
                protocol.getDocxFileId() != null ? "/api/protocols/" + protocol.getId() + "/download-docx" : null,
                protocol.getPdfFileId() != null ? "/api/protocols/" + protocol.getId() + "/download-pdf" : null,
                toPrintVisibility(protocol),
                protocol.getVersion(),
                permissionService.calculate(protocol, currentUser, signatureRows.size(), signedByCurrentUser),
                signatureRows.size(),
                signingProperties.getMaxSignatures(),
                signedByCurrentUser,
                signatures,
                protocol.getOrderId(),
                protocol.getPekProgramId(),
                protocol.getPekReportId(),
                protocol.getPekControlItemId(),
                protocol.getPekControlEventId(),
                protocol.getMonitoringPointId(),
                protocol.getEmissionSourceId(),
                protocol.getWaterOutletId(),
                formatDateTime(protocol.getPublishedAt()),
                protocol.getPublishedBy()
        );
    }

    private ProtocolApiDtos.EnvironmentData toEnvironment(ProtocolEnvironmentConditions env) {
        if (env == null) return null;
        return new ProtocolApiDtos.EnvironmentData(
                env.getTemperatureC(),
                env.getTemperatureMinC(),
                env.getTemperatureMaxC(),
                env.getHumidityPercent(),
                env.getHumidityMinPercent(),
                env.getHumidityMaxPercent(),
                env.getPressureKpa(),
                null,
                env.getWindSpeedMs(),
                env.getConditionsComment(),
                env.getSource(),
                env.getDataSource(),
                env.getWeatherObservedAt() != null ? env.getWeatherObservedAt().toString() : null,
                null,
                env.getManualChangeReason()
        );
    }

    private ProtocolApiDtos.CompanySnapshotData toCompany(Protocol protocol) {
        return new ProtocolApiDtos.CompanySnapshotData(
                nullToEmpty(protocol.getCompanyNameSnapshot()),
                nullToEmpty(protocol.getCompanyBinSnapshot()),
                nullToEmpty(protocol.getCompanyLegalAddressSnapshot()),
                nullToEmpty(protocol.getCompanyActualAddressSnapshot()),
                nullToEmpty(protocol.getCompanyPhoneSnapshot()),
                nullToEmpty(protocol.getCompanyEmailSnapshot()),
                nullToEmpty(protocol.getCompanyDirectorNameSnapshot()),
                nullToEmpty(protocol.getCompanyDirectorPositionSnapshot()),
                nullToEmpty(protocol.getCompanyResponsiblePersonSnapshot()),
                nullToEmpty(protocol.getCompanyResponsiblePersonPhoneSnapshot()),
                nullToEmpty(protocol.getCompanyBankNameSnapshot()),
                nullToEmpty(protocol.getCompanyIbanSnapshot()),
                nullToEmpty(protocol.getCompanyBikSnapshot()),
                nullToEmpty(protocol.getCompanyKbeSnapshot()),
                nullToEmpty(protocol.getCompanyKnpSnapshot()),
                nullToEmpty(protocol.getCompanyContractNumberSnapshot()),
                formatDate(protocol.getCompanyContractDateSnapshot()),
                nullToEmpty(protocol.getObjectNameSnapshot()),
                nullToEmpty(protocol.getObjectAddressSnapshot()),
                nullToEmpty(protocol.getActivityTypeSnapshot()),
                nullToEmpty(protocol.getSamplingLocationSnapshot()),
                nullToEmpty(protocol.getCustomerRepresentativeSnapshot())
        );
    }

    public ProtocolApiDtos.NormativeRecord toNormative(NormativeReference entity) {
        String templateId = NormativeApiContract.normalizeTemplateId(normalizeLegacyTemplateId(entity.getTemplateCode()));
        String sourceDocumentCode = NormativeApiContract.inferSourceDocumentCode(templateId);
        String pollutantCode = resolveLegacyPollutantCode(entity);
        String environment = entity.getObjectType();
        String value = decimalToString(entity.getNormativeValue());
        String indicator = entity.getIndicatorName();
        return NormativeRecordBuilder.create()
                .id(String.valueOf(entity.getId()))
                .code(pollutantCode)
                .pollutantCode(pollutantCode)
                .templateId(templateId)
                .researchObject(environment)
                .environment(environment)
                .indicator(indicator)
                .indicatorName(indicator)
                .indicatorNameRu(indicator)
                .pollutantName(indicator)
                .unit(entity.getUnit())
                .normativeType(NormativeTypeLabels.fromNormativeType(entity.getNormativeType()))
                .value(value)
                .normativeValue(value)
                .singleValue(value)
                .min(decimalToString(entity.getMinValue()))
                .max(decimalToString(entity.getMaxValue()))
                .comparisonType(toApiComparison(entity.getComparisonType()))
                .normativeDocument(entity.getNormativeDocument())
                .testingMethod(entity.getTestingMethodNd())
                .samplingMethod(entity.getSamplingMethodNd())
                .validFrom(formatDate(entity.getActiveFrom()))
                .validUntil(formatDate(entity.getActiveTo()))
                .active(entity.isActive())
                .archived(!entity.isActive())
                .sourceDocumentCode(sourceDocumentCode)
                .sourceDocumentName(NormativeApiContract.resolveSourceDocumentName(sourceDocumentCode))
                .build();
    }

    private static String normalizeLegacyTemplateId(String templateCode) {
        if (templateCode == null || templateCode.isBlank()) {
            return null;
        }
        ProtocolTemplateCode code = ProtocolTemplateCode.fromApi(templateCode);
        if (code != null) {
            return code.toApiId();
        }
        return templateCode.trim().toLowerCase(Locale.ROOT).replace('-', '_');
    }

    private static String resolveLegacyPollutantCode(NormativeReference entity) {
        return switch (entity.getIndicatorName() != null ? entity.getIndicatorName().trim() : "") {
            case "Диоксид азота" -> "0301";
            case "Железо" -> "0123";
            case "Пыль" -> "0300";
            case "Шум" -> "NOISE";
            case "E.coli" -> "ECOLI";
            default -> entity.getIndicatorName();
        };
    }

    ProtocolApiDtos.MeasurementDeviceData toDevice(MeasurementDevice device) {
        device.refreshStatus();
        return new ProtocolApiDtos.MeasurementDeviceData(
                String.valueOf(device.getId()),
                device.getName(),
                device.getModel(),
                device.getSerialNumber(),
                device.getVerificationCertificateNumber(),
                formatDate(device.getVerificationDate()),
                formatDate(device.getVerificationValidUntil()),
                device.getUnits(),
                device.getStatus().name(),
                device.getStatus() == MeasurementDeviceStatus.ARCHIVED
        );
    }

    void applyLaboratory(Protocol protocol, ProtocolApiDtos.LaboratoryData data) {
        if (data == null) {
            return;
        }
        Map<String, Object> snapshot = readLaboratorySnapshot(protocol.getLaboratorySnapshot());
        mergeLaboratoryData(snapshot, data);
        applyLaboratoryColumns(protocol, snapshot);
        writeLaboratorySnapshot(protocol, snapshot);
    }

    void applyLaboratoryFromEntity(Protocol protocol, Laboratory laboratory, LaboratoryEmployee executor) {
        if (laboratory == null) {
            return;
        }
        Map<String, Object> snapshot = buildLaboratorySnapshot(laboratory, executor);
        applyLaboratoryColumns(protocol, snapshot);
        writeLaboratorySnapshot(protocol, snapshot);
    }

    /**
     * executorId in the snapshot is always a laboratory_employees.id (never a users.id) —
     * executorUserId carries the linked user account separately for callers that need it.
     */
    Map<String, Object> buildLaboratorySnapshot(Laboratory laboratory, LaboratoryEmployee executor) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", laboratory.getId());
        snapshot.put("laboratoryId", laboratory.getId());
        snapshot.put("name", laboratory.getName());
        snapshot.put("laboratoryName", laboratory.getName());
        snapshot.put("legalName", laboratory.getLegalName());
        snapshot.put("bin", laboratory.getBin());
        snapshot.put("address", laboratory.getAddress());
        snapshot.put("laboratoryAddress", laboratory.getAddress());
        snapshot.put("phone", laboratory.getPhone());
        snapshot.put("email", laboratory.getEmail());
        snapshot.put("accreditationNumber", laboratory.getAccreditationNumber());
        snapshot.put("accreditationIssuedAt", formatDate(laboratory.getAccreditationIssuedAt()));
        snapshot.put("accreditationValidUntil", formatDate(laboratory.getAccreditationValidUntil()));
        snapshot.put("directorId", laboratory.getDirectorId());
        snapshot.put("directorName", laboratory.getDirectorName());
        snapshot.put("director", laboratory.getDirectorName());
        snapshot.put("laboratoryHeadId", laboratory.getLaboratoryHeadId());
        snapshot.put("laboratoryHeadName", laboratory.getLaboratoryHeadName());
        snapshot.put("laboratoryHead", laboratory.getLaboratoryHeadName());
        if (executor != null) {
            snapshot.put("executorId", executor.getId());
            if (executor.getUserId() != null) {
                snapshot.put("executorUserId", executor.getUserId());
            }
            if (executor.getFullName() != null && !executor.getFullName().isBlank()) {
                snapshot.put("executorName", executor.getFullName());
                snapshot.put("executor", executor.getFullName());
            }
        }
        snapshot.put("logoUrl", laboratory.getLogoUrl());
        snapshot.put("logoFileId", laboratory.getLogoFileId());
        snapshot.put("standardNote", laboratory.getStandardNote());
        snapshot.put("capturedAt", LocalDateTime.now().toString());
        return snapshot;
    }

    Long resolveLaboratoryIdFromSnapshot(String laboratorySnapshotJson) {
        Map<String, Object> snapshot = readLaboratorySnapshot(laboratorySnapshotJson);
        return parseLongSafe(firstNonBlank(snapshot.get("laboratoryId"), snapshot.get("id")));
    }

    Long resolveExecutorIdFromSnapshot(String laboratorySnapshotJson) {
        Map<String, Object> snapshot = readLaboratorySnapshot(laboratorySnapshotJson);
        return parseLongSafe(firstNonBlank(snapshot.get("executorId")));
    }

    Long resolveExecutorUserIdFromSnapshot(String laboratorySnapshotJson) {
        Map<String, Object> snapshot = readLaboratorySnapshot(laboratorySnapshotJson);
        return parseLongSafe(firstNonBlank(snapshot.get("executorUserId")));
    }

    void applyOrganization(Protocol protocol, ProtocolApiDtos.OrganizationData data) {
        if (data == null) {
            return;
        }
        if (data.organizationName() != null) protocol.setOrganizationName(data.organizationName());
        if (data.organizationAddress() != null) protocol.setOrganizationAddress(data.organizationAddress());
        if (data.objectName() != null) protocol.setObjectName(data.objectName());
        if (data.productName() != null) protocol.setProductName(data.productName());
        if (data.testingBasis() != null) protocol.setBasisForTesting(data.testingBasis());
    }

    void applyTesting(Protocol protocol, ProtocolApiDtos.TestingData data) {
        if (data == null) {
            return;
        }
        if (data.productNormativeDocument() != null) protocol.setProductNd(data.productNormativeDocument());
        if (data.samplingMethodDocument() != null) protocol.setSamplingMethodNd(data.samplingMethodDocument());
        if (data.testingMethodDocument() != null) protocol.setTestingMethodNd(data.testingMethodDocument());
        if (data.samplingDate() != null) protocol.setSampleDate(parseDate(data.samplingDate()));
        if (data.testingDate() != null) protocol.setTestDate(parseDate(data.testingDate()));
        if (data.testingPurpose() != null) protocol.setTestPurpose(data.testingPurpose());
        if (data.environmentConditions() != null) protocol.setEnvironmentConditions(data.environmentConditions());
    }

    void writeInstruments(Protocol protocol, List<ProtocolApiDtos.MeasurementDeviceData> instruments) {
        if (instruments == null) {
            return;
        }
        try {
            protocol.setInstrumentsJson(objectMapper.writeValueAsString(instruments));
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось сохранить приборы", ex);
        }
    }

    List<ProtocolApiDtos.MeasurementDeviceData> readInstruments(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            return List.of();
        }
    }

    /**
     * Merges only the non-null fields of {@code visibility} into whatever print-visibility
     * settings the protocol already has (a PATCH that omits a field must not silently reset it
     * back to visible), then writes the merged map back as JSON. A field's underlying value on
     * the protocol is never touched by this - only ProtocolDocxTemplateRenderer reads this map,
     * to decide whether to print it.
     */
    void applyPrintVisibility(Protocol protocol, ProtocolApiDtos.ProtocolPrintVisibility visibility) {
        if (visibility == null) {
            return;
        }
        Map<String, Object> stored = readPrintVisibilityMap(protocol.getPrintVisibilityJson());
        putIfPresentBool(stored, "organizationName", visibility.organizationName());
        putIfPresentBool(stored, "organizationAddress", visibility.organizationAddress());
        putIfPresentBool(stored, "testObjectName", visibility.testObjectName());
        putIfPresentBool(stored, "productName", visibility.productName());
        putIfPresentBool(stored, "testBasis", visibility.testBasis());
        putIfPresentBool(stored, "samplingDate", visibility.samplingDate());
        putIfPresentBool(stored, "testStartDate", visibility.testStartDate());
        putIfPresentBool(stored, "testEndDate", visibility.testEndDate());
        putIfPresentBool(stored, "productNormativeDocument", visibility.productNormativeDocument());
        putIfPresentBool(stored, "samplingMethodDocument", visibility.samplingMethodDocument());
        putIfPresentBool(stored, "testMethodDocument", visibility.testMethodDocument());
        putIfPresentBool(stored, "testPurpose", visibility.testPurpose());
        putIfPresentBool(stored, "samplingPlace", visibility.samplingPlace());
        putIfPresentBool(stored, "measurementDate", visibility.measurementDate());
        putIfPresentBool(stored, "environmentalConditions", visibility.environmentalConditions());
        putIfPresentBool(stored, "temperature", visibility.temperature());
        putIfPresentBool(stored, "humidity", visibility.humidity());
        putIfPresentBool(stored, "pressure", visibility.pressure());
        putIfPresentBool(stored, "windSpeed", visibility.windSpeed());
        try {
            protocol.setPrintVisibilityJson(objectMapper.writeValueAsString(stored));
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось сохранить настройки видимости полей протокола", ex);
        }
    }

    /** A field with no stored setting (new protocol, or never toggled) defaults to visible. */
    ProtocolApiDtos.ProtocolPrintVisibility toPrintVisibility(Protocol protocol) {
        Map<String, Object> stored = readPrintVisibilityMap(protocol.getPrintVisibilityJson());
        return new ProtocolApiDtos.ProtocolPrintVisibility(
                visibleOrDefault(stored.get("organizationName")),
                visibleOrDefault(stored.get("organizationAddress")),
                visibleOrDefault(stored.get("testObjectName")),
                visibleOrDefault(stored.get("productName")),
                visibleOrDefault(stored.get("testBasis")),
                visibleOrDefault(stored.get("samplingDate")),
                visibleOrDefault(stored.get("testStartDate")),
                visibleOrDefault(stored.get("testEndDate")),
                visibleOrDefault(stored.get("productNormativeDocument")),
                visibleOrDefault(stored.get("samplingMethodDocument")),
                visibleOrDefault(stored.get("testMethodDocument")),
                visibleOrDefault(stored.get("testPurpose")),
                visibleOrDefault(stored.get("samplingPlace")),
                visibleOrDefault(stored.get("measurementDate")),
                visibleOrDefault(stored.get("environmentalConditions")),
                visibleOrDefault(stored.get("temperature")),
                visibleOrDefault(stored.get("humidity")),
                visibleOrDefault(stored.get("pressure")),
                visibleOrDefault(stored.get("windSpeed"))
        );
    }

    private static void putIfPresentBool(Map<String, Object> map, String key, Boolean value) {
        if (value != null) {
            map.put(key, value);
        }
    }

    private static boolean visibleOrDefault(Object storedValue) {
        return !(storedValue instanceof Boolean explicit) || explicit;
    }

    private Map<String, Object> readPrintVisibilityMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return new LinkedHashMap<>(objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            }));
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private ProtocolApiDtos.LaboratoryData toLaboratory(Protocol protocol) {
        Map<String, Object> snapshot = readLaboratorySnapshot(protocol.getLaboratorySnapshot());
        String id = firstNonBlank(snapshot.get("id"), snapshot.get("laboratoryId"));
        String laboratoryId = firstNonBlank(snapshot.get("laboratoryId"), snapshot.get("id"));
        return new ProtocolApiDtos.LaboratoryData(
                nullToEmpty(id),
                nullToEmpty(laboratoryId),
                nullToEmpty(firstNonBlank(snapshot.get("name"), snapshot.get("laboratoryName"), protocol.getLaboratoryName())),
                nullToEmpty(firstNonBlank(snapshot.get("laboratoryName"), snapshot.get("name"), protocol.getLaboratoryName())),
                nullToEmpty(str(snapshot.get("legalName"))),
                nullToEmpty(str(snapshot.get("bin"))),
                nullToEmpty(firstNonBlank(snapshot.get("address"), snapshot.get("laboratoryAddress"), protocol.getLaboratoryAddress())),
                nullToEmpty(firstNonBlank(snapshot.get("laboratoryAddress"), snapshot.get("address"), protocol.getLaboratoryAddress())),
                nullToEmpty(str(snapshot.get("phone"))),
                nullToEmpty(str(snapshot.get("email"))),
                nullToEmpty(firstNonBlank(snapshot.get("accreditationNumber"), protocol.getAccreditationNumber())),
                nullToEmpty(firstNonBlank(snapshot.get("accreditationIssuedAt"), formatDate(protocol.getAccreditationValidFrom()))),
                nullToEmpty(firstNonBlank(snapshot.get("accreditationValidUntil"), formatDate(protocol.getAccreditationValidUntil()))),
                nullToEmpty(str(snapshot.get("directorId"))),
                nullToEmpty(firstNonBlank(snapshot.get("directorName"), snapshot.get("director"), protocol.getDirectorName())),
                nullToEmpty(firstNonBlank(snapshot.get("director"), snapshot.get("directorName"), protocol.getDirectorName())),
                nullToEmpty(str(snapshot.get("laboratoryHeadId"))),
                nullToEmpty(firstNonBlank(snapshot.get("laboratoryHeadName"), snapshot.get("laboratoryHead"), protocol.getHeadOfLaboratoryName())),
                nullToEmpty(firstNonBlank(snapshot.get("laboratoryHead"), snapshot.get("laboratoryHeadName"), protocol.getHeadOfLaboratoryName())),
                nullToEmpty(str(snapshot.get("executorId"))),
                nullToEmpty(firstNonBlank(snapshot.get("executorName"), snapshot.get("executor"), protocol.getExecutorName())),
                nullToEmpty(firstNonBlank(snapshot.get("executor"), snapshot.get("executorName"), protocol.getExecutorName())),
                nullToEmpty(str(snapshot.get("logoUrl"))),
                nullToEmpty(str(snapshot.get("standardNote"))),
                nullToEmpty(str(snapshot.get("capturedAt")))
        );
    }

    private Map<String, Object> readLaboratorySnapshot(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return new LinkedHashMap<>(objectMapper.readValue(json, new TypeReference<>() {}));
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
        }
    }

    private void writeLaboratorySnapshot(Protocol protocol, Map<String, Object> snapshot) {
        if (snapshot == null || snapshot.isEmpty()) {
            return;
        }
        try {
            protocol.setLaboratorySnapshot(objectMapper.writeValueAsString(snapshot));
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось сохранить snapshot лаборатории", ex);
        }
    }

    private void mergeLaboratoryData(Map<String, Object> snapshot, ProtocolApiDtos.LaboratoryData data) {
        putIfPresent(snapshot, "id", firstNonBlank(data.id(), data.laboratoryId()));
        putIfPresent(snapshot, "laboratoryId", firstNonBlank(data.laboratoryId(), data.id()));
        putIfPresent(snapshot, "name", firstNonBlank(data.name(), data.laboratoryName()));
        putIfPresent(snapshot, "laboratoryName", firstNonBlank(data.laboratoryName(), data.name()));
        putIfPresent(snapshot, "legalName", data.legalName());
        putIfPresent(snapshot, "bin", data.bin());
        putIfPresent(snapshot, "address", firstNonBlank(data.address(), data.laboratoryAddress()));
        putIfPresent(snapshot, "laboratoryAddress", firstNonBlank(data.laboratoryAddress(), data.address()));
        putIfPresent(snapshot, "phone", data.phone());
        putIfPresent(snapshot, "email", data.email());
        putIfPresent(snapshot, "accreditationNumber", data.accreditationNumber());
        putIfPresent(snapshot, "accreditationIssuedAt", data.accreditationIssuedAt());
        putIfPresent(snapshot, "accreditationValidUntil", data.accreditationValidUntil());
        putIfPresent(snapshot, "directorId", data.directorId());
        putIfPresent(snapshot, "directorName", firstNonBlank(data.directorName(), data.director()));
        putIfPresent(snapshot, "director", firstNonBlank(data.director(), data.directorName()));
        putIfPresent(snapshot, "laboratoryHeadId", data.laboratoryHeadId());
        putIfPresent(snapshot, "laboratoryHeadName", firstNonBlank(data.laboratoryHeadName(), data.laboratoryHead()));
        putIfPresent(snapshot, "laboratoryHead", firstNonBlank(data.laboratoryHead(), data.laboratoryHeadName()));
        putIfPresent(snapshot, "executorId", data.executorId());
        putIfPresent(snapshot, "executorName", firstNonBlank(data.executorName(), data.executor()));
        putIfPresent(snapshot, "executor", firstNonBlank(data.executor(), data.executorName()));
        putIfPresent(snapshot, "logoUrl", data.logoUrl());
        putIfPresent(snapshot, "standardNote", data.standardNote());
        putIfPresent(snapshot, "capturedAt", data.capturedAt() != null ? data.capturedAt() : LocalDateTime.now().toString());
    }

    private void applyLaboratoryColumns(Protocol protocol, Map<String, Object> snapshot) {
        String name = firstNonBlank(snapshot.get("laboratoryName"), snapshot.get("name"));
        if (name != null) protocol.setLaboratoryName(name);
        String address = firstNonBlank(snapshot.get("laboratoryAddress"), snapshot.get("address"));
        if (address != null) protocol.setLaboratoryAddress(address);
        String accreditation = str(snapshot.get("accreditationNumber"));
        if (accreditation != null) protocol.setAccreditationNumber(accreditation);
        String issuedAt = str(snapshot.get("accreditationIssuedAt"));
        if (issuedAt != null) protocol.setAccreditationValidFrom(parseDate(issuedAt));
        String validUntil = str(snapshot.get("accreditationValidUntil"));
        if (validUntil != null) protocol.setAccreditationValidUntil(parseDate(validUntil));
        String director = firstNonBlank(snapshot.get("directorName"), snapshot.get("director"));
        if (director != null) protocol.setDirectorName(director);
        String head = firstNonBlank(snapshot.get("laboratoryHeadName"), snapshot.get("laboratoryHead"));
        if (head != null) protocol.setHeadOfLaboratoryName(head);
        String executor = firstNonBlank(snapshot.get("executorName"), snapshot.get("executor"));
        if (executor != null) protocol.setExecutorName(executor);
        String logoFileId = str(snapshot.get("logoFileId"));
        if (logoFileId != null) protocol.setLaboratoryLogoFileId(logoFileId);
    }

    private static void putIfPresent(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value);
        }
    }

    private static String str(Object value) {
        return value != null ? String.valueOf(value).trim() : null;
    }

    private static String firstNonBlank(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            String text = str(value);
            if (text != null && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private static Long parseLongSafe(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private ProtocolApiDtos.OrganizationData toOrganization(Protocol protocol) {
        return new ProtocolApiDtos.OrganizationData(
                nullToEmpty(protocol.getOrganizationName()),
                nullToEmpty(protocol.getOrganizationAddress()),
                nullToEmpty(protocol.getObjectName()),
                nullToEmpty(protocol.getProductName()),
                nullToEmpty(protocol.getBasisForTesting())
        );
    }

    private ProtocolApiDtos.TestingData toTesting(Protocol protocol) {
        return new ProtocolApiDtos.TestingData(
                nullToEmpty(protocol.getProductNd()),
                nullToEmpty(protocol.getSamplingMethodNd()),
                nullToEmpty(protocol.getTestingMethodNd()),
                formatDate(protocol.getSampleDate()),
                formatDate(protocol.getTestDate()),
                nullToEmpty(protocol.getTestPurpose()),
                nullToEmpty(protocol.getEnvironmentConditions()),
                null
        );
    }

    private List<ProtocolApiDtos.HistoryItem> loadHistory(Long protocolId) {
        return auditLogRepository.findByProtocolIdOrderByCreatedAtDesc(protocolId).stream()
                .map(log -> new ProtocolApiDtos.HistoryItem(
                        String.valueOf(log.getId()),
                        log.getAction().name(),
                        log.getUserId() != null ? String.valueOf(log.getUserId()) : null,
                        formatDateTime(log.getCreatedAt()),
                        log.getComment()
                ))
                .toList();
    }

    public static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return LocalDate.parse(value);
    }

    public static String formatDate(LocalDate value) {
        return value != null ? value.toString() : "";
    }

    static String formatDateTime(LocalDateTime value) {
        return value != null ? value.toString() : null;
    }

    public static String decimalToString(java.math.BigDecimal value) {
        return value != null ? value.toPlainString() : null;
    }

    public static String toApiComparison(ComparisonType type) {
        if (type == null) {
            return null;
        }
        return type == ComparisonType.BETWEEN ? ComparisonType.RANGE.name() : type.name();
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }
}
