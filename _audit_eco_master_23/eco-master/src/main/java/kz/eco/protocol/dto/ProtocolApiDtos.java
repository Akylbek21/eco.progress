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
            ProtocolPrintVisibility printVisibility,
            /** Previously absent from this DTO entirely (unlike CreateProtocolDraftRequest/
             *  QuickCreateProtocolRequest/UpdateProtocolRequest, which all had it) - a client using
             *  the plain POST /api/protocols create path had no way to link an order at creation
             *  time; see ProtocolService.create/linkOrder. */
            String orderId,
            String orderServiceItemId
    ) {
    }

    /**
     * Minimal-field creation contract for a genuine server-side DRAFT (module spec §1): only
     * templateId is required. Everything else - company/object, laboratory/executor, order,
     * dates - is optional and stored as-is with no measurement rows, no normative resolution,
     * and no status transition beyond DRAFT. Use CreateProtocolRequest / quick-create for a
     * fully-populated protocol; use this + PATCH /{id}/draft to build one up incrementally.
     */
    /** PEK context to link a draft protocol with monitoring program/report/control items.
     *  Only relevant when creating from ПЭК module - contains identifiers from the control
     *  workflow that initiated protocol creation. */
    public record ProtocolPekContextRequest(
            Long pekProgramId,
            Long pekReportId,
            Long pekControlItemId,
            /** The exact {@link kz.eco.pek.PekProgramIndicator} this protocol is measuring.
             *  Persisted on the canonical link row (PekReportProtocolSource.programIndicatorId) -
             *  never silently dropped. Validated server-side to belong to pekControlItemId and to
             *  the resolved program. */
            Long programIndicatorId,
            Long pekControlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String clientLinkId
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateProtocolDraftRequest(
            String templateId,
            String subtype,
            Long companyId,
            Long objectId,
            String protocolDate,
            String measurementDate,
            Long laboratoryId,
            Long executorId,
            String orderId,
            String orderServiceItemId,
            ProtocolPrintVisibility printVisibility,
            String testingStartDate,
            String testingEndDate,
            EnvironmentData environment,
            ProtocolPekContextRequest pekContext,
            String sourceNumber
    ) {
        public CreateProtocolDraftRequest(String templateId, String subtype, Long companyId,
                                          Long objectId, String protocolDate, String measurementDate,
                                          Long laboratoryId, Long executorId, String orderId,
                                          String orderServiceItemId,
                                          ProtocolPrintVisibility printVisibility) {
            this(templateId, subtype, companyId, objectId, protocolDate, measurementDate,
                    laboratoryId, executorId, orderId, orderServiceItemId, printVisibility,
                    null, null, null, null, null);
        }
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
            @JsonAlias("temperature") java.math.BigDecimal temperatureC,
            java.math.BigDecimal temperatureMinC,
            java.math.BigDecimal temperatureMaxC,
            @JsonAlias("humidity") java.math.BigDecimal humidityPercent,
            java.math.BigDecimal humidityMinPercent,
            java.math.BigDecimal humidityMaxPercent,
            @JsonAlias("pressure") java.math.BigDecimal pressureKpa,
            java.math.BigDecimal pressureHpa,
            @JsonAlias("windSpeed") java.math.BigDecimal windSpeedMs,
            String conditionsComment,
            String source,
            String dataSource,
            String observedAt,
            String loadedAt,
            String manualChangeReason,
            /** Header-level (one-per-protocol) type-specific condition fields - see
             *  ProtocolEnvironmentConditions for why these live here rather than per result row.
             *  Null means "not supplied in this request", not "clear existing values" - see
             *  ProtocolService.saveEnvironmentConditions, which merges rather than replaces this
             *  sub-object so an update() call that omits it never wipes conditions set earlier by
             *  quick-create. */
            TypeConditions conditions
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        public record TypeConditions(
                String season,
                String workCategory,
                String roomType,
                String workplaceType,
                String lightingType,
                String noiseType,
                String visualWorkCategory,
                String normLevel,
                String sampleNumber,
                String samplingDepth,
                String samplingPlace,
                String waterType,
                String waterUseCategory,
                String factorType
        ) {
            public TypeConditions(String season, String workCategory, String roomType,
                                  String workplaceType, String lightingType, String noiseType,
                                  String visualWorkCategory, String normLevel, String sampleNumber,
                                  String samplingDepth, String samplingPlace, String waterType,
                                  String waterUseCategory) {
                this(season, workCategory, roomType, workplaceType, lightingType, noiseType,
                        visualWorkCategory, normLevel, sampleNumber, samplingDepth, samplingPlace,
                        waterType, waterUseCategory, null);
            }
        }
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
            /** Module spec §8. Same soft-link convention as create()/quick-create; orderServiceItemId
             *  alone (without orderId) is rejected - see ProtocolService.applyOrderChange. */
            String orderId,
            String orderServiceItemId,
            /** Optimistic-locking token: the version the client last read. Null means "don't
             *  check" (kept optional for backward compatibility with older frontend builds), but
             *  any client that read the protocol via GET should always send back what it got. */
            Long version,
            /** Canonical top-level laboratory id. When present it wins over nested snapshot ids. */
            Long laboratoryId,
            /** Accepted only to return an explicit immutable-company error after draft creation. */
            Long companyId,
            /** Free-text identifier from the source document/registration log - same field/
             *  sanitization as CreateProtocolRequest.sourceNumber (see ProtocolService.update). */
            String sourceNumber,
            /** Bulk sync of sampling points (module fix): null means "leave sampling points
             *  untouched" (same convention as results/instruments being omitted); an explicit list
             *  - including an empty one - fully reconciles the protocol's sampling points against
             *  it (create new, update existing by id, delete missing) - see
             *  ProtocolService.syncSamplingPoints. */
            List<SamplingPointRequest> samplingPoints
    ) {
        public UpdateProtocolRequest(String number, String protocolDate, Long objectId,
                                     String executor, Long executorId, String approver,
                                     LaboratoryData laboratory, OrganizationData organization,
                                     TestingData testing, String testingMethodDocument,
                                     List<ResultRow> results, List<MeasurementDeviceData> instruments,
                                     EnvironmentData environment, String explanatoryNote, String subtype,
                                     String complianceDocument, String testingStartDate, String testingEndDate,
                                     String formCode, String appendixNumber, String measurementDate,
                                     String measurementTime, String measurementPlace,
                                     ProtocolPrintVisibility printVisibility, String orderId,
                                     String orderServiceItemId, Long version) {
            this(number, protocolDate, objectId, executor, executorId, approver, laboratory,
                    organization, testing, testingMethodDocument, results, instruments, environment,
                    explanatoryNote, subtype, complianceDocument, testingStartDate, testingEndDate,
                    formCode, appendixNumber, measurementDate, measurementTime, measurementPlace,
                    printVisibility, orderId, orderServiceItemId, version, null, null, null, null);
        }
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
            Long contentVersion,
            Long signingRevision,
            ProtocolPermissions permissions,
            /** Module spec item 2: keyed re-projection of {@code permissions} (see
             *  ProtocolPermissions#toAvailableActions) - status+role+current-user aware, computed
             *  server-side only, never client-suppliable. */
            Map<String, Boolean> availableActions,
            Integer signatureCount,
            Integer maxSignatures,
            Boolean signedByCurrentUser,
            List<ProtocolSignatureData> signatures,
            String orderId,
            String orderServiceItemId,
            Long pekProgramId,
            Long pekReportId,
            Long pekControlItemId,
            Long pekControlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String publishedAt,
            Long publishedBy,
            /** Blockers per workflow action - computed server-side from the same validation
             *  service used by the real transition so availableActions never lies. Null/absent
             *  means no blockers were computed (e.g. list view); empty map means none found. */
            Map<String, List<kz.eco.common.ApiFieldError>> actionBlockers,
            /** Module fix: sampling points now round-trip through GET/PATCH the same way results
             *  do, so the frontend gets server-assigned ids and the current version for each point
             *  right out of a PATCH response without a second GET .../sampling-points call. */
            List<SamplingPointResponse> samplingPoints
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
    /** P1 module fix item 1: single unambiguous availableActions contract - every field here is
     *  computed by {@link kz.eco.protocol.ProtocolPermissionService#calculate} from actor role +
     *  protocol access scope + status + document state + version/state invariants together, and
     *  is the ONLY source of truth the frontend and every controller/service guard both read from
     *  (module fix item 2: a field here must never read true while the matching endpoint would
     *  then 403/409 for a different reason). generateDocuments/regenerateDocuments (ambiguous:
     *  which format?) are retired in favor of the four explicit per-format actions below. */
    public record ProtocolPermissions(
            boolean canView,
            boolean canEdit,
            boolean canDelete,
            boolean canCalculate,
            boolean canCheckNormatives,
            boolean canGeneratePreview,
            boolean canSendToApproval,
            boolean canReturnForRevision,
            boolean canReturnToDraft,
            boolean canApprove,
            boolean canSign,
            boolean canCreateCorrection,
            boolean canCancel,
            boolean canArchive,
            boolean canPublish,
            boolean canGenerateDocx,
            boolean canGeneratePdf,
            boolean canRegenerateDocx,
            boolean canRegeneratePdf,
            boolean canDownloadDocx,
            boolean canDownloadPdf,
            boolean canViewAudit
    ) {
        public static ProtocolPermissions none() {
            return new ProtocolPermissions(
                    false, false, false, false, false, false,
                    false, false, false, false, false, false, false, false, false,
                    false, false, false, false, false, false, false);
        }

        /** Same booleans, keyed map form (module spec item 2) - mirrors kz.eco.pek's
         *  availableActions pattern so the frontend can use one uniform "is this action
         *  available" lookup shape across modules instead of a module-specific permissions
         *  record. This is a pure re-projection of the fields above - never a second
         *  independently-computed source of truth. */
        public Map<String, Boolean> toAvailableActions() {
            Map<String, Boolean> actions = new java.util.LinkedHashMap<>();
            actions.put("view", canView);
            actions.put("edit", canEdit);
            actions.put("delete", canDelete);
            actions.put("calculate", canCalculate);
            actions.put("checkNormatives", canCheckNormatives);
            actions.put("generatePreview", canGeneratePreview);
            actions.put("sendToApproval", canSendToApproval);
            actions.put("returnForRevision", canReturnForRevision);
            actions.put("returnToDraft", canReturnToDraft);
            actions.put("approve", canApprove);
            actions.put("sign", canSign);
            actions.put("generateDocx", canGenerateDocx);
            actions.put("generatePdf", canGeneratePdf);
            actions.put("regenerateDocx", canRegenerateDocx);
            actions.put("regeneratePdf", canRegeneratePdf);
            actions.put("downloadDocx", canDownloadDocx);
            actions.put("downloadPdf", canDownloadPdf);
            actions.put("viewAudit", canViewAudit);
            actions.put("createCorrection", canCreateCorrection);
            actions.put("publish", canPublish);
            actions.put("cancel", canCancel);
            actions.put("archive", canArchive);
            return actions;
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
            Map<String, Boolean> availableActions,
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
            Long pekReportId,
            Map<String, List<kz.eco.common.ApiFieldError>> actionBlockers
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

    /** P1 module fix item 3: returnToDraft used to accept a bare {@link VersionRequest} - the
     *  caller's reason for undoing an approval/return-to-draft was silently discarded, replaced in
     *  the audit log by a fixed "Возвращён в черновик" string. version and reason are both
     *  mandatory (validated in ProtocolService#returnToDraft, same convention as
     *  ReturnForRevisionRequest, except reason is required here rather than optional). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReturnToDraftRequest(Long version, String reason) {
    }

    /** version is optional (null = skip the optimistic-lock check) purely for backward
     *  compatibility with any pre-existing caller that never sent one - a client that does send it
     *  gets the same stale-version 409 protection every other mutating protocol endpoint has. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SignProtocolRequest(String cmsSignatureBase64, Long version) {
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

    /** Draft-results batch save (module spec: atomic add/update/delete of result rows in one
     *  request) - clientRowId lets the frontend match a newly-added row back to its backend id
     *  without a second round trip; it is carried inside {@code values} on the response, not as a
     *  separate DB column. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DraftResultCreateRequest(
            String clientRowId,
            Long normativeId,
            Long measurementDeviceId,
            /** Sampling point FK. Required for AMBIENT_AIR_SZZ; ignored/null for other types. */
            Long samplingPointId,
            Map<String, Object> values
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DraftResultUpdateRequest(
            Long id,
            Long normativeId,
            Long measurementDeviceId,
            /** Sampling point FK. Required for AMBIENT_AIR_SZZ; ignored/null for other types. */
            Long samplingPointId,
            Map<String, Object> values
    ) {
    }

    /** {@code results} is deliberately declared here (not just left as an unknown property):
     *  the app's Jackson setup tolerates unrecognized JSON properties by default (a class-level
     *  {@code ignoreUnknown=false} is not enough to force strict rejection, since it only opts
     *  back into the global DeserializationFeature, which is off), so silently-dropping the old
     *  top-level {@code results} field is not reliable. Declaring it explicitly lets the service
     *  detect it and reject the request with a clear 400 instead. */
    public record DraftResultsBatchRequest(
            Long version,
            List<DraftResultCreateRequest> added,
            List<DraftResultUpdateRequest> updated,
            List<Long> deletedIds,
            Object results
    ) {
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
            String orderId,
            /** Module spec §8: which line item within orderId this protocol fulfills - only
             *  meaningful together with orderId (ProtocolService rejects it alone). */
            String orderServiceItemId
    ) {
    }

    /** POST /api/protocols/{id}/publish-to-client body (spec §26) - optimistic-locking version
     *  only, same convention as every other workflow command. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PublishToClientRequest(Long version) {
    }

    // ── Sampling points ──────────────────────────────────────────────────────────────────────────

    /** POST/PATCH body for a sampling point. version is required on PATCH (If-Match header wins
     *  over body.version when both are supplied, same pattern as company objects). id is ignored
     *  by the single-point POST/PUT sub-resource endpoints (the point id is in the URL path there)
     *  but is how UpdateProtocolRequest.samplingPoints' bulk sync tells an existing point apart
     *  from a new one - null id means "create"; a non-null id must belong to this protocol. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SamplingPointRequest(
            Long id,
            String name,
            String description,
            java.math.BigDecimal latitude,
            java.math.BigDecimal longitude,
            Integer sortOrder,
            Long version
    ) {}

    /** Full representation of a sampling point as returned by GET/POST/PATCH. */
    public record SamplingPointResponse(
            Long id,
            Long protocolId,
            String name,
            String description,
            java.math.BigDecimal latitude,
            java.math.BigDecimal longitude,
            int sortOrder,
            java.time.Instant createdAt,
            java.time.Instant updatedAt,
            Long version
    ) {
        public static SamplingPointResponse from(kz.eco.protocol.ProtocolSamplingPoint p) {
            return new SamplingPointResponse(p.getId(), p.getProtocolId(), p.getName(),
                    p.getDescription(), p.getLatitude(), p.getLongitude(), p.getSortOrder(),
                    p.getCreatedAt(), p.getUpdatedAt(), p.getVersion());
        }
    }

    /** POST /protocols/{id}/sampling-points/{pointId}/copy-indicators body.
     *  Copies indicator metadata (name, unit, normativeId, testing method) from sourcePointId's
     *  results into each targetPointId's results WITHOUT copying measured values. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CopyIndicatorsRequest(
            Long sourcePointId,
            java.util.List<Long> targetPointIds
    ) {}
}
