package kz.eco.protocol.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

public final class ProtocolApiDtos {

    private ProtocolApiDtos() {
    }

    /**
     * id/name/description are kept for backward compatibility with the per-protocol "which
     * template is this" mapping (ProtocolApiMapper.toTemplate); sourceDocumentCode onward are
     * the full ProtocolTypeRegistry config and are null there (only populated by
     * ProtocolService.listTemplates(), which is what GET /api/protocols/templates returns).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProtocolTemplateResponse(
            String id,
            String name,
            String description,
            String sourceDocumentCode,
            String docxTemplateCode,
            String normativeTemplateId,
            String resultMode,
            String defaultUnit,
            Boolean active
    ) {
        public static ProtocolTemplateResponse basic(String id, String name, String description) {
            return new ProtocolTemplateResponse(id, name, description, null, null, null, null, null, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateProtocolRequest(
            String templateId,
            Long companyId,
            Long objectId,
            String protocolNumber,
            String protocolDate,
            String sampleDate,
            String samplingDate,
            String testingDate,
            String testingStartDate,
            String testingEndDate,
            String testPurpose,
            String testingPurpose,
            String purpose,
            String environmentConditions,
            String environmentalConditions,
            String productName,
            String testingBasis,
            String samplingMethodDocument,
            String productNormativeDocument,
            String testingMethodDocument,
            String subtype,
            String formCode,
            String appendixNumber,
            EnvironmentData environment,
            String measurementDate,
            String measurementTime,
            String measurementPlace,
            String sourceNumber,
            Long laboratoryId,
            Long executorId,
            ProtocolPrintVisibility printVisibility
    ) {
    }

    /**
     * Per-field toggle for whether a field is printed into the generated DOCX/PDF. A false/hidden
     * field's underlying value is untouched in the database and in every other API response -
     * this only controls what ProtocolDocxTemplateRenderer renders. Any field left null (not
     * included in a PATCH body) keeps its previously stored setting; a brand new protocol with no
     * setting at all for a field defaults to visible (true) - see ProtocolApiMapper.toPrintVisibility.
     */
    /**
     * Legacy frontend key names are accepted on the way in via @JsonAlias for backward
     * compatibility, but every response always serializes using the canonical record component
     * names below - a client must never see the old aliases echoed back.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProtocolPrintVisibility(
            Boolean organizationName,
            Boolean organizationAddress,
            @JsonAlias("objectName") Boolean testObjectName,
            Boolean productName,
            @JsonAlias("testingBasis") Boolean testBasis,
            Boolean samplingDate,
            @JsonAlias("testingStartDate") Boolean testStartDate,
            @JsonAlias("testingEndDate") Boolean testEndDate,
            Boolean productNormativeDocument,
            Boolean samplingMethodDocument,
            @JsonAlias("testingMethodDocument") Boolean testMethodDocument,
            @JsonAlias("testingPurpose") Boolean testPurpose,
            @JsonAlias("measurementPlace") Boolean samplingPlace,
            Boolean measurementDate,
            @JsonAlias("environmentConditions") Boolean environmentalConditions,
            Boolean temperature,
            Boolean humidity,
            @JsonAlias("pressureKpa") Boolean pressure,
            Boolean windSpeed
    ) {
        public static ProtocolPrintVisibility allVisible() {
            return new ProtocolPrintVisibility(true, true, true, true, true, true, true, true, true,
                    true, true, true, true, true, true, true, true, true, true);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EnvironmentData(
            java.math.BigDecimal temperatureC,
            java.math.BigDecimal temperatureMinC,
            java.math.BigDecimal temperatureMaxC,
            java.math.BigDecimal humidityPercent,
            java.math.BigDecimal humidityMinPercent,
            java.math.BigDecimal humidityMaxPercent,
            java.math.BigDecimal pressureKpa,
            java.math.BigDecimal pressureHpa,
            java.math.BigDecimal windSpeedMs,
            String conditionsComment,
            String source,
            String dataSource,
            String observedAt,
            String loadedAt,
            String manualChangeReason
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UpdateProtocolRequest(
            String number,
            String protocolDate,
            /** company_objects.id - changing it re-resolves canonical id + snapshot fields from
             *  the company_objects table; the frontend does not currently send this on PATCH
             *  (object changes happen at create time), but the contract supports it. */
            Long objectId,
            /** Display-name fallback only - ignored whenever executorId is present, since the
             *  canonical executor snapshot must always come from a resolved LaboratoryEmployee,
             *  never from a client-supplied string (spec: backend must not trust displayName). */
            String executor,
            /** laboratory_employees.id. When present, the executor snapshot (name incl.) is
             *  rebuilt from the resolved employee row - see ProtocolService.update. */
            Long executorId,
            String approver,
            LaboratoryData laboratory,
            OrganizationData organization,
            TestingData testing,
            /** Flat alias for testing.testingMethodDocument - some frontend call sites PATCH
             * {"testingMethodDocument": "..."} directly instead of nesting it under "testing".
             * Both shapes must be accepted; see ProtocolService.update. */
            String testingMethodDocument,
            List<ResultRow> results,
            List<MeasurementDeviceData> instruments,
            EnvironmentData environment,
            String explanatoryNote,
            String subtype,
            String complianceDocument,
            String testingStartDate,
            String testingEndDate,
            String formCode,
            String appendixNumber,
            /** Top-level date/time/place fields the live frontend actually sends on every PATCH
             *  (see ProtocolCreatePage/ProtocolEditorPage) - previously silently dropped by
             *  @JsonIgnoreProperties(ignoreUnknown), since no record component captured them. */
            String measurementDate,
            String measurementTime,
            String measurementPlace,
            ProtocolPrintVisibility printVisibility,
            /** Optimistic-locking token: the version the client last read. Null means "don't
             *  check" (kept optional for backward compatibility with older frontend builds), but
             *  any client that read the protocol via GET should always send back what it got. */
            Long version
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LaboratoryData(
            String id,
            String laboratoryId,
            String name,
            String laboratoryName,
            String legalName,
            String bin,
            String address,
            String laboratoryAddress,
            String phone,
            String email,
            String accreditationNumber,
            String accreditationIssuedAt,
            String accreditationValidUntil,
            String directorId,
            String directorName,
            String director,
            String laboratoryHeadId,
            String laboratoryHeadName,
            String laboratoryHead,
            String executorId,
            String executorName,
            String executor,
            String logoUrl,
            String standardNote,
            String capturedAt
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record OrganizationData(
            String organizationName,
            String organizationAddress,
            String objectName,
            String productName,
            String testingBasis
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TestingData(
            String productNormativeDocument,
            String samplingMethodDocument,
            String testingMethodDocument,
            String samplingDate,
            String testingDate,
            String testingPurpose,
            String environmentConditions,
            String physicalFactorType
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ResultRow(
            String id,
            String protocolId,
            String internalStatus,
            Map<String, Object> values
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MeasurementDeviceData(
            String id,
            String name,
            String model,
            String serialNumber,
            String verificationCertificateNumber,
            String verificationDate,
            String verificationValidUntil,
            String units,
            String status,
            Boolean archived
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProtocolResponse(
            String id,
            String number,
            String protocolNumber,
            String templateId,
            String templateName,
            String status,
            String protocolDate,
            Long companyId,
            Long objectId,
            CompanySnapshotData company,
            CompanySnapshotData companySnapshot,
            String subtype,
            String formCode,
            String appendixNumber,
            String executor,
            String approver,
            String approvedAt,
            String signedAt,
            String measurementDate,
            String measurementTime,
            String measurementPlace,
            String sourceNumber,
            LaboratoryData laboratory,
            OrganizationData organization,
            TestingData testing,
            EnvironmentData environment,
            List<Map<String, Object>> results,
            List<MeasurementDeviceData> instruments,
            List<MeasurementDeviceData> measurementDevices,
            List<HistoryItem> history,
            String explanatoryNote,
            String complianceStatus,
            String complianceDocument,
            String testingStartDate,
            String testingEndDate,
            String createdAt,
            String updatedAt,
            String replacedByProtocolId,
            String replacesProtocolId,
            String docxFileId,
            String pdfFileId,
            String docxDownloadUrl,
            String pdfDownloadUrl,
            ProtocolPrintVisibility printVisibility,
            Long version,
            ProtocolPermissions permissions,
            Integer signatureCount,
            Integer maxSignatures,
            Boolean signedByCurrentUser,
            List<ProtocolSignatureData> signatures,
            String orderId,
            Long pekProgramId,
            Long pekReportId,
            Long pekControlItemId,
            Long pekControlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String publishedAt,
            Long publishedBy
    ) {
    }

    /** One row from protocol_signatures - see ProtocolSignature/ProtocolService#sign. */
    public record ProtocolSignatureData(
            String id,
            Long userId,
            String signerFullName,
            String signerPosition,
            String signedAt
    ) {
    }

    /** Centrally-computed action availability for the current user against this protocol's
     *  current status (see kz.eco.protocol.ProtocolPermissionService) - the frontend renders
     *  buttons/actions from this instead of re-deriving role+status logic itself. */
    public record ProtocolPermissions(
            boolean canView,
            boolean canEdit,
            boolean canDelete,
            boolean canCalculate,
            boolean canCheckNormatives,
            boolean canGeneratePreview,
            boolean canSendToApproval,
            boolean canReturnForRevision,
            boolean canApprove,
            boolean canSign,
            boolean canCreateCorrection,
            boolean canCancel,
            boolean canArchive,
            boolean canPublish
    ) {
        public static ProtocolPermissions none() {
            return new ProtocolPermissions(
                    false, false, false, false, false, false,
                    false, false, false, false, false, false, false, false);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CompanySnapshotData(
            String name,
            String bin,
            String legalAddress,
            String actualAddress,
            String phone,
            String email,
            String directorName,
            String directorPosition,
            String responsiblePerson,
            String responsiblePersonPhone,
            String bankName,
            String iban,
            String bik,
            String kbe,
            String knp,
            String contractNumber,
            String contractDate,
            String objectName,
            String objectAddress,
            String activityType,
            String samplingLocation,
            String customerRepresentative
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HistoryItem(String id, String action, String actorName, String createdAt, String comment) {
    }

    /** Lean row for GET /api/protocols (paginated list) - deliberately does NOT include
     *  results/instruments/history, so listing a page never pulls per-row result sets (the N+1
     *  the old list() had by mapping every row through the full ProtocolResponse builder).
     *  signatureCount/permissions ARE included, but batch-computed for the whole page (see
     *  ProtocolService.list()/toListItem) rather than per-row, to keep this N+1-free. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProtocolListItemDto(
            String id,
            String protocolNumber,
            String templateId,
            String templateName,
            String subtype,
            String status,
            String protocolDate,
            Long companyId,
            String companyName,
            String companyBin,
            Long objectId,
            String objectName,
            Long laboratoryId,
            String laboratoryName,
            Long executorId,
            String executorName,
            String complianceStatus,
            String createdAt,
            String updatedAt,
            Long version,
            ProtocolPermissions permissions,
            Integer signatureCount,
            Integer maxSignatures,
            Boolean hasDocx,
            Boolean hasPdf,
            String docxFileId,
            String pdfFileId,
            String publishedAt,
            Long publishedBy,
            String replacesProtocolId,
            String replacedByProtocolId,
            String orderId,
            Long pekProgramId,
            Long pekReportId
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReplaceProtocolRequest(@JsonAlias("comment") String reason, Long version) {
    }

    /** Shared minimal body for workflow endpoints that only ever need the optimistic-locking
     *  token (readyForApproval, approve, archive, returnToDraft, checkNormatives, detach-device) -
     *  null version means "don't check" (backward compatible with older frontend builds). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VersionRequest(Long version) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReturnForRevisionRequest(Long version, @JsonAlias("comment") String reason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CancelProtocolRequest(Long version, @JsonAlias("comment") String reason) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SignProtocolRequest(String cmsSignatureBase64) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NormativeRecord(
            String id,
            String code,
            String pollutantCode,
            String templateId,
            String researchObject,
            String environment,
            String indicator,
            String unit,
            String normativeType,
            String value,
            String min,
            String max,
            String comparisonType,
            String normativeDocument,
            String testingMethod,
            String samplingMethod,
            String validFrom,
            String validUntil,
            String indicatorName,
            String indicatorNameRu,
            String indicatorNameKz,
            String pollutantName,
            String casNumber,
            String formula,
            String chemicalFormula,
            String templateType,
            String environmentType,
            String normativeSubType,
            String normativeValue,
            String maxOneTimeValue,
            String dailyAverageValue,
            String singleValue,
            String obuvValue,
            String hazardClass,
            String limitingIndicator,
            String sourceFile,
            boolean active,
            Boolean archived,
            String sourceDocumentCode,
            String sourceDocumentName,
            String documentNumber,
            String documentDate,
            Integer appendixNo,
            Integer tableNo,
            String factorType,
            String factorCode,
            String roomType,
            String season,
            String workCategory,
            String workplaceType,
            String normLevel,
            String conditionJson,
            String matrixType,
            String assessmentCategory,
            String pollutionDegree,
            String formType,
            String categoryCode,
            String waterType,
            String synonyms,
            String waterUseCategory
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NormativeUpsertRequest(
            String templateId,
            String researchObject,
            String indicator,
            String unit,
            String normativeType,
            String value,
            String min,
            String max,
            String comparisonType,
            String normativeDocument,
            String testingMethod,
            String samplingMethod,
            String validFrom,
            String validUntil,
            Boolean active,
            String casNumber,
            String chemicalFormula,
            String normativeSubType,
            String hazardClass,
            String limitingIndicator,
            String sourceDocumentCode,
            String sourceDocumentName,
            String documentNumber,
            String documentDate,
            Integer appendixNo,
            Integer tableNo,
            String factorType,
            String factorCode,
            String roomType,
            String season,
            String workCategory,
            String workplaceType,
            String normLevel,
            String conditionJson
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NormativeSearchResponse(
            boolean found,
            NormativeRecord normative,
            List<NormativeRecord> normatives,
            List<NormativeRecord> items,
            Boolean ambiguous,
            String warning
    ) {
        public NormativeSearchResponse(boolean found, NormativeRecord normative, String warning) {
            this(found, normative, normative != null ? List.of(normative) : List.of(),
                    normative != null ? List.of(normative) : List.of(), false, warning);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NormativeImportPreviewResponse(int totalRows, List<NormativeRecord> preview, List<String> warnings) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AttachMeasurementDeviceRequest(Long deviceId, String id, Long version) {
    }

    /** Bulk result operations (spec §13) - each is applied atomically to every listed row inside
     *  a single transaction: either all rows change, or (on any error, e.g. an unowned id or an
     *  unusable device) none do. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BulkDeviceUpdateRequest(Long version, List<Long> resultIds, Long measurementDeviceId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BulkPlaceUpdateRequest(Long version, List<Long> resultIds, String measurementPlace) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BulkDeleteResultsRequest(Long version, List<Long> resultIds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QuickCreateConditions(
            String season,
            String workCategory,
            String workplaceType,
            String roomType,
            String normLevel,
            String temperature,
            String humidity,
            String pressure,
            String windSpeed,
            String sampleNumber,
            String samplingDepth,
            String samplingPlace,
            String lightingType,
            String noiseType,
            String visualWorkCategory,
            String waterType,
            String waterUseCategory,
            String weatherSource,
            String weatherDataSource,
            String manualChangeReason,
            String weatherObservedAt
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QuickCreateMeasurement(
            String factorType,
            String factorCode,
            String pollutantCode,
            String indicatorName,
            Object value,
            String unit,
            String normativeId,
            String normativeValue,
            String testingMethodNd,
            String samplingMethodNd,
            /** Primary field for the measurement device used for this row. Fallback order when
             * this is null: deviceId, then values.measurementDeviceId, then values.deviceId - see
             * ProtocolService.resolveMeasurementDeviceId. */
            Long measurementDeviceId,
            Long deviceId,
            Map<String, Object> values
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record QuickCreateProtocolRequest(
            String templateId,
            String sourceDocumentCode,
            String docxTemplateCode,
            String subtype,
            Long companyId,
            Long objectId,
            Long laboratoryId,
            Long executorId,
            String protocolDate,
            /** Date the sample was taken. Distinct from measurementDate/testingStartDate/
             *  testingEndDate below - previously this field didn't exist at all, so the frontend's
             *  separately-sent sampleDate was silently dropped and measurementDate was copied into
             *  every date column instead. When absent, ProtocolService.quickCreate falls back to
             *  measurementDate (documented, backward-compat only - see quickCreate's javadoc). */
            String sampleDate,
            String measurementDate,
            String measurementTime,
            String measurementPlace,
            /** Testing start/end dates - same "previously silently dropped" issue as sampleDate.
             *  Fallback when absent: testingStartDate -> measurementDate, testingEndDate ->
             *  testingStartDate (after its own fallback has been applied). */
            String testingStartDate,
            String testingEndDate,
            /** Free-text identifier from the source document/registration log. Optional; sanitized
             *  (trimmed, control characters stripped, length-capped) before being stored - never
             *  required to be unique. */
            String sourceNumber,
            QuickCreateConditions conditions,
            List<QuickCreateMeasurement> measurements,
            ProtocolPrintVisibility printVisibility,
            /** Optional soft link to the order/CRM request this protocol was created for (spec
             *  §25) - kz.eco.order.Order's id, a String, not a numeric id. */
            String orderId
    ) {
    }

    /** POST /api/protocols/{id}/publish-to-client body (spec §26) - optimistic-locking version
     *  only, same convention as every other workflow command. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PublishToClientRequest(Long version) {
    }
}
