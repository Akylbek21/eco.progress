package kz.eco.protocol;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "lab_protocols")
public class Protocol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId;

    @Column(length = 60)
    private String templateCode;

    @Column(length = 40)
    private String subtype;

    @Column(nullable = false, unique = true, length = 40)
    private String protocolNumber;

    @Column(length = 40)
    private String formCode;

    @Column(length = 20)
    private String appendixNumber;

    @Column(nullable = false)
    private LocalDate protocolDate;

    private Integer totalPages;

    @Column(length = 300)
    private String laboratoryName;

    @Column(length = 400)
    private String laboratoryAddress;

    @Column(length = 64)
    private String laboratoryLogoFileId;

    @Column(length = 80)
    private String accreditationNumber;

    private LocalDate accreditationValidFrom;
    private LocalDate accreditationValidUntil;

    @Column(length = 200)
    private String directorName;

    @Column(length = 200)
    private String headOfLaboratoryName;

    @Column(length = 200)
    private String executorName;

    @Column(length = 300)
    private String organizationName;

    @Column(length = 400)
    private String organizationAddress;

    private Long companyId;
    private Long objectId;

    /** Canonical FK ids (laboratories.id / laboratory_employees.id) kept alongside the name
     *  snapshots below - added so the protocol list can filter/index by lab/executor without a
     *  join or a fragile name match. Historical rows created before this column existed are null;
     *  the name snapshots remain the source of truth for what was actually printed on them. */
    private Long laboratoryId;
    private Long executorId;

    @Column(columnDefinition = "JSON")
    private String companySnapshot;

    @Column(columnDefinition = "JSON")
    private String objectSnapshot;

    @Column(columnDefinition = "JSON")
    private String laboratorySnapshot;

    @Column(length = 255)
    private String companyNameSnapshot;

    @Column(length = 32)
    private String companyBinSnapshot;

    @Column(length = 500)
    private String companyLegalAddressSnapshot;

    @Column(length = 500)
    private String companyActualAddressSnapshot;

    @Column(length = 64)
    private String companyPhoneSnapshot;

    @Column(length = 255)
    private String companyEmailSnapshot;

    @Column(length = 255)
    private String companyDirectorNameSnapshot;

    @Column(length = 255)
    private String companyDirectorPositionSnapshot;

    @Column(length = 255)
    private String companyResponsiblePersonSnapshot;

    @Column(length = 64)
    private String companyResponsiblePersonPhoneSnapshot;

    @Column(length = 255)
    private String companyBankNameSnapshot;

    @Column(length = 64)
    private String companyIbanSnapshot;

    @Column(length = 64)
    private String companyBikSnapshot;

    @Column(length = 32)
    private String companyKbeSnapshot;

    @Column(length = 32)
    private String companyKnpSnapshot;

    @Column(length = 128)
    private String companyContractNumberSnapshot;

    private LocalDate companyContractDateSnapshot;

    @Column(length = 300)
    private String productName;

    @Column(length = 300)
    private String objectName;

    @Column(length = 255)
    private String objectNameSnapshot;

    @Column(length = 500)
    private String objectAddressSnapshot;

    @Column(length = 255)
    private String activityTypeSnapshot;

    @Column(length = 500)
    private String samplingLocationSnapshot;

    @Column(length = 255)
    private String customerRepresentativeSnapshot;

    @Column(length = 500)
    private String basisForTesting;

    @Column(length = 500)
    private String testingBasis;

    @Column(length = 200)
    private String productNd;

    @Column(length = 300)
    private String productNormativeDocument;

    @Column(length = 200)
    private String samplingMethodNd;

    @Column(length = 300)
    private String samplingMethodDocument;

    @Column(length = 200)
    private String testingMethodNd;

    @Column(length = 300)
    private String testingMethodDocument;

    private LocalDate sampleDate;
    private LocalDate testDate;
    private LocalDate testingStartDate;
    private LocalDate testingEndDate;

    @Column(length = 300)
    private String testPurpose;

    @Column(length = 500)
    private String testingPurpose;

    @Column(length = 300)
    private String environmentConditions;

    @Column(length = 20)
    private String measurementTime;

    @Column(length = 80)
    private String sourceNumber;

    @Column(columnDefinition = "TEXT")
    private String explanatoryNote;

    @Column(length = 300)
    private String complianceDocument;

    @Column(length = 30)
    private String complianceStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProtocolStatus status = ProtocolStatus.DRAFT;

    @Column(nullable = false)
    private Long createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    private Long approvedBy;
    private LocalDateTime approvedAt;
    private Long signedBy;
    private LocalDateTime signedAt;

    @Column(length = 64)
    private String signatureFileId;

    @Column(length = 64)
    private String pdfFileId;

    @Column(length = 64)
    private String docxFileId;

    private Long replacedProtocolId;

    /** Forward pointer, set on the OLD (now REPLACED) row when a correction is created - the
     *  backward pointer above (replacedProtocolId) lives on the NEW copy. Together they make the
     *  correction chain traversable in both directions without a repository query (spec §24). */
    private Long replacedByProtocolId;

    @Column(length = 500)
    private String replacementReason;

    /** SHA-256 (hex) of the final signed PDF, computed at sign time - lets publish-to-client and
     *  any later audit confirm the exact bytes that were signed were never altered. */
    @Column(length = 64)
    private String pdfSha256;

    @Column(columnDefinition = "TEXT")
    private String signatureCertificateMetadata;

    /** Soft link to the order/CRM request this protocol was created for (spec §25) - optional,
     *  since not every protocol originates from an order in this system today. kz.eco.order.Order's
     *  id is a String(32) (not a Long), so this must match that type, not the numeric ids used
     *  elsewhere on this entity (companyId, laboratoryId, ...). */
    @Column(length = 32)
    private String orderId;

    private LocalDateTime publishedAt;

    private Long publishedBy;

    /**
     * DEPRECATED, read-only legacy soft links into the ПЭК (производственный экологический
     * контроль) module - all nullable, no FK constraints, matching orderId's pattern above.
     * As of the link-model unification (module spec §5), {@code kz.eco.pek.PekReportProtocolSource}
     * is the ONE canonical, enforced source of truth for protocol<->report/program/control-item
     * linking (report_id/program_id/control_item_id/control_event_id/monitoring_point_id/
     * emission_source_id/water_outlet_id/waste_source_id all live there, per-link rather than
     * per-protocol, so one protocol can belong to several reports at once). Nothing in this
     * codebase writes to these seven columns on Protocol - they predate the join table and are
     * kept only because ProtocolApiMapper/ProtocolApiDtos already expose them on the wire and a
     * frontend may read them; do not add new writers here. New code must go through
     * kz.eco.pek.PekReportCollectionService / PekReportProtocolSourceRepository instead.
     */
    private Long pekProgramId;

    private Long pekReportId;

    private Long pekControlItemId;

    private Long pekControlEventId;

    private Long monitoringPointId;

    private Long emissionSourceId;

    private Long waterOutletId;

    @Column(columnDefinition = "TEXT")
    private String instrumentsJson;

    /** Per-field DOCX/PDF print visibility toggles (ProtocolApiDtos.ProtocolPrintVisibility),
     * stored as a partial JSON map - a field absent from the map defaults to visible. See
     * ProtocolApiMapper.applyPrintVisibility/toPrintVisibility. */
    @Column(columnDefinition = "TEXT")
    private String printVisibilityJson;

    private LocalDateTime deletedAt;

    /** Deliberately left uninitialized (not {@code = 0L}): Spring Data's default isNew() check
     *  for an entity with a non-primitive @Version field is "version == null", not "id == null".
     *  A non-null default here made every brand-new Protocol look "already persisted", so
     *  save()/saveAndFlush() called entityManager.merge() instead of persist() - the row got
     *  inserted with a real generated id, but that id was never written back onto the Protocol
     *  instance the caller kept using (merge() returns a separate managed copy). Every immediately
     *  -following insert that referenced protocol.getId() (audit log, environment conditions, ...)
     *  then sent a NULL FK and blew up with a constraint violation. Hibernate assigns the initial
     *  version (0) on insert regardless of the Java field being null beforehand, so leaving this
     *  uninitialized loses nothing and is required for persist() to be selected correctly. */
    @Version
    @Column(nullable = false)
    private Long version;

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTemplateId() { return templateId; }
    public void setTemplateId(Long templateId) { this.templateId = templateId; }
    public String getTemplateCode() { return templateCode; }
    public void setTemplateCode(String templateCode) { this.templateCode = templateCode; }
    public String getSubtype() { return subtype; }
    public void setSubtype(String subtype) { this.subtype = subtype; }
    public String getProtocolNumber() { return protocolNumber; }
    public void setProtocolNumber(String protocolNumber) { this.protocolNumber = protocolNumber; }
    public String getFormCode() { return formCode; }
    public void setFormCode(String formCode) { this.formCode = formCode; }
    public String getAppendixNumber() { return appendixNumber; }
    public void setAppendixNumber(String appendixNumber) { this.appendixNumber = appendixNumber; }
    public LocalDate getProtocolDate() { return protocolDate; }
    public void setProtocolDate(LocalDate protocolDate) { this.protocolDate = protocolDate; }
    public Integer getTotalPages() { return totalPages; }
    public void setTotalPages(Integer totalPages) { this.totalPages = totalPages; }
    public String getLaboratoryName() { return laboratoryName; }
    public void setLaboratoryName(String laboratoryName) { this.laboratoryName = laboratoryName; }
    public String getLaboratoryAddress() { return laboratoryAddress; }
    public void setLaboratoryAddress(String laboratoryAddress) { this.laboratoryAddress = laboratoryAddress; }
    public String getLaboratoryLogoFileId() { return laboratoryLogoFileId; }
    public void setLaboratoryLogoFileId(String laboratoryLogoFileId) { this.laboratoryLogoFileId = laboratoryLogoFileId; }
    public String getAccreditationNumber() { return accreditationNumber; }
    public void setAccreditationNumber(String accreditationNumber) { this.accreditationNumber = accreditationNumber; }
    public LocalDate getAccreditationValidFrom() { return accreditationValidFrom; }
    public void setAccreditationValidFrom(LocalDate accreditationValidFrom) { this.accreditationValidFrom = accreditationValidFrom; }
    public LocalDate getAccreditationValidUntil() { return accreditationValidUntil; }
    public void setAccreditationValidUntil(LocalDate accreditationValidUntil) { this.accreditationValidUntil = accreditationValidUntil; }
    public String getDirectorName() { return directorName; }
    public void setDirectorName(String directorName) { this.directorName = directorName; }
    public String getHeadOfLaboratoryName() { return headOfLaboratoryName; }
    public void setHeadOfLaboratoryName(String headOfLaboratoryName) { this.headOfLaboratoryName = headOfLaboratoryName; }
    public String getExecutorName() { return executorName; }
    public void setExecutorName(String executorName) { this.executorName = executorName; }
    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }
    public String getOrganizationAddress() { return organizationAddress; }
    public void setOrganizationAddress(String organizationAddress) { this.organizationAddress = organizationAddress; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getObjectId() { return objectId; }
    public void setObjectId(Long objectId) { this.objectId = objectId; }
    public Long getLaboratoryId() { return laboratoryId; }
    public void setLaboratoryId(Long laboratoryId) { this.laboratoryId = laboratoryId; }
    public Long getExecutorId() { return executorId; }
    public void setExecutorId(Long executorId) { this.executorId = executorId; }
    public String getCompanySnapshot() { return companySnapshot; }
    public void setCompanySnapshot(String companySnapshot) { this.companySnapshot = companySnapshot; }
    public String getObjectSnapshot() { return objectSnapshot; }
    public void setObjectSnapshot(String objectSnapshot) { this.objectSnapshot = objectSnapshot; }
    public String getLaboratorySnapshot() { return laboratorySnapshot; }
    public void setLaboratorySnapshot(String laboratorySnapshot) { this.laboratorySnapshot = laboratorySnapshot; }
    public String getCompanyNameSnapshot() { return companyNameSnapshot; }
    public void setCompanyNameSnapshot(String companyNameSnapshot) { this.companyNameSnapshot = companyNameSnapshot; }
    public String getCompanyBinSnapshot() { return companyBinSnapshot; }
    public void setCompanyBinSnapshot(String companyBinSnapshot) { this.companyBinSnapshot = companyBinSnapshot; }
    public String getCompanyLegalAddressSnapshot() { return companyLegalAddressSnapshot; }
    public void setCompanyLegalAddressSnapshot(String companyLegalAddressSnapshot) { this.companyLegalAddressSnapshot = companyLegalAddressSnapshot; }
    public String getCompanyActualAddressSnapshot() { return companyActualAddressSnapshot; }
    public void setCompanyActualAddressSnapshot(String companyActualAddressSnapshot) { this.companyActualAddressSnapshot = companyActualAddressSnapshot; }
    public String getCompanyPhoneSnapshot() { return companyPhoneSnapshot; }
    public void setCompanyPhoneSnapshot(String companyPhoneSnapshot) { this.companyPhoneSnapshot = companyPhoneSnapshot; }
    public String getCompanyEmailSnapshot() { return companyEmailSnapshot; }
    public void setCompanyEmailSnapshot(String companyEmailSnapshot) { this.companyEmailSnapshot = companyEmailSnapshot; }
    public String getCompanyDirectorNameSnapshot() { return companyDirectorNameSnapshot; }
    public void setCompanyDirectorNameSnapshot(String companyDirectorNameSnapshot) { this.companyDirectorNameSnapshot = companyDirectorNameSnapshot; }
    public String getCompanyDirectorPositionSnapshot() { return companyDirectorPositionSnapshot; }
    public void setCompanyDirectorPositionSnapshot(String companyDirectorPositionSnapshot) { this.companyDirectorPositionSnapshot = companyDirectorPositionSnapshot; }
    public String getCompanyResponsiblePersonSnapshot() { return companyResponsiblePersonSnapshot; }
    public void setCompanyResponsiblePersonSnapshot(String companyResponsiblePersonSnapshot) { this.companyResponsiblePersonSnapshot = companyResponsiblePersonSnapshot; }
    public String getCompanyResponsiblePersonPhoneSnapshot() { return companyResponsiblePersonPhoneSnapshot; }
    public void setCompanyResponsiblePersonPhoneSnapshot(String companyResponsiblePersonPhoneSnapshot) { this.companyResponsiblePersonPhoneSnapshot = companyResponsiblePersonPhoneSnapshot; }
    public String getCompanyBankNameSnapshot() { return companyBankNameSnapshot; }
    public void setCompanyBankNameSnapshot(String companyBankNameSnapshot) { this.companyBankNameSnapshot = companyBankNameSnapshot; }
    public String getCompanyIbanSnapshot() { return companyIbanSnapshot; }
    public void setCompanyIbanSnapshot(String companyIbanSnapshot) { this.companyIbanSnapshot = companyIbanSnapshot; }
    public String getCompanyBikSnapshot() { return companyBikSnapshot; }
    public void setCompanyBikSnapshot(String companyBikSnapshot) { this.companyBikSnapshot = companyBikSnapshot; }
    public String getCompanyKbeSnapshot() { return companyKbeSnapshot; }
    public void setCompanyKbeSnapshot(String companyKbeSnapshot) { this.companyKbeSnapshot = companyKbeSnapshot; }
    public String getCompanyKnpSnapshot() { return companyKnpSnapshot; }
    public void setCompanyKnpSnapshot(String companyKnpSnapshot) { this.companyKnpSnapshot = companyKnpSnapshot; }
    public String getCompanyContractNumberSnapshot() { return companyContractNumberSnapshot; }
    public void setCompanyContractNumberSnapshot(String companyContractNumberSnapshot) { this.companyContractNumberSnapshot = companyContractNumberSnapshot; }
    public LocalDate getCompanyContractDateSnapshot() { return companyContractDateSnapshot; }
    public void setCompanyContractDateSnapshot(LocalDate companyContractDateSnapshot) { this.companyContractDateSnapshot = companyContractDateSnapshot; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getObjectName() { return objectName; }
    public void setObjectName(String objectName) { this.objectName = objectName; }
    public String getObjectNameSnapshot() { return objectNameSnapshot; }
    public void setObjectNameSnapshot(String objectNameSnapshot) { this.objectNameSnapshot = objectNameSnapshot; }
    public String getObjectAddressSnapshot() { return objectAddressSnapshot; }
    public void setObjectAddressSnapshot(String objectAddressSnapshot) { this.objectAddressSnapshot = objectAddressSnapshot; }
    public String getActivityTypeSnapshot() { return activityTypeSnapshot; }
    public void setActivityTypeSnapshot(String activityTypeSnapshot) { this.activityTypeSnapshot = activityTypeSnapshot; }
    public String getSamplingLocationSnapshot() { return samplingLocationSnapshot; }
    public void setSamplingLocationSnapshot(String samplingLocationSnapshot) { this.samplingLocationSnapshot = samplingLocationSnapshot; }
    public String getCustomerRepresentativeSnapshot() { return customerRepresentativeSnapshot; }
    public void setCustomerRepresentativeSnapshot(String customerRepresentativeSnapshot) { this.customerRepresentativeSnapshot = customerRepresentativeSnapshot; }
    public String getBasisForTesting() { return basisForTesting; }
    public void setBasisForTesting(String basisForTesting) { this.basisForTesting = basisForTesting; }
    public String getTestingBasis() { return testingBasis; }
    public void setTestingBasis(String testingBasis) { this.testingBasis = testingBasis; }
    public String getProductNd() { return productNd; }
    public void setProductNd(String productNd) { this.productNd = productNd; }
    public String getProductNormativeDocument() { return productNormativeDocument; }
    public void setProductNormativeDocument(String productNormativeDocument) { this.productNormativeDocument = productNormativeDocument; }
    public String getSamplingMethodNd() { return samplingMethodNd; }
    public void setSamplingMethodNd(String samplingMethodNd) { this.samplingMethodNd = samplingMethodNd; }
    public String getSamplingMethodDocument() { return samplingMethodDocument; }
    public void setSamplingMethodDocument(String samplingMethodDocument) { this.samplingMethodDocument = samplingMethodDocument; }
    public String getTestingMethodNd() { return testingMethodNd; }
    public void setTestingMethodNd(String testingMethodNd) { this.testingMethodNd = testingMethodNd; }
    public String getTestingMethodDocument() { return testingMethodDocument; }
    public void setTestingMethodDocument(String testingMethodDocument) { this.testingMethodDocument = testingMethodDocument; }
    public LocalDate getSampleDate() { return sampleDate; }
    public void setSampleDate(LocalDate sampleDate) { this.sampleDate = sampleDate; }
    public LocalDate getTestDate() { return testDate; }
    public void setTestDate(LocalDate testDate) { this.testDate = testDate; }
    public LocalDate getTestingStartDate() { return testingStartDate; }
    public void setTestingStartDate(LocalDate testingStartDate) { this.testingStartDate = testingStartDate; }
    public LocalDate getTestingEndDate() { return testingEndDate; }
    public void setTestingEndDate(LocalDate testingEndDate) { this.testingEndDate = testingEndDate; }
    public String getTestPurpose() { return testPurpose; }
    public void setTestPurpose(String testPurpose) { this.testPurpose = testPurpose; }
    public String getTestingPurpose() { return testingPurpose; }
    public void setTestingPurpose(String testingPurpose) { this.testingPurpose = testingPurpose; }
    public String getEnvironmentConditions() { return environmentConditions; }
    public void setEnvironmentConditions(String environmentConditions) { this.environmentConditions = environmentConditions; }
    public String getMeasurementTime() { return measurementTime; }
    public void setMeasurementTime(String measurementTime) { this.measurementTime = measurementTime; }
    public String getSourceNumber() { return sourceNumber; }
    public void setSourceNumber(String sourceNumber) { this.sourceNumber = sourceNumber; }
    public String getExplanatoryNote() { return explanatoryNote; }
    public void setExplanatoryNote(String explanatoryNote) { this.explanatoryNote = explanatoryNote; }
    public String getComplianceDocument() { return complianceDocument; }
    public void setComplianceDocument(String complianceDocument) { this.complianceDocument = complianceDocument; }
    public String getComplianceStatus() { return complianceStatus; }
    public void setComplianceStatus(String complianceStatus) { this.complianceStatus = complianceStatus; }
    public ProtocolStatus getStatus() { return status; }
    public void setStatus(ProtocolStatus status) { this.status = status; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Long approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public Long getSignedBy() { return signedBy; }
    public void setSignedBy(Long signedBy) { this.signedBy = signedBy; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public String getSignatureFileId() { return signatureFileId; }
    public void setSignatureFileId(String signatureFileId) { this.signatureFileId = signatureFileId; }
    public String getPdfFileId() { return pdfFileId; }
    public void setPdfFileId(String pdfFileId) { this.pdfFileId = pdfFileId; }
    public String getDocxFileId() { return docxFileId; }
    public void setDocxFileId(String docxFileId) { this.docxFileId = docxFileId; }
    public Long getReplacedProtocolId() { return replacedProtocolId; }
    public void setReplacedProtocolId(Long replacedProtocolId) { this.replacedProtocolId = replacedProtocolId; }
    public Long getReplacedByProtocolId() { return replacedByProtocolId; }
    public void setReplacedByProtocolId(Long replacedByProtocolId) { this.replacedByProtocolId = replacedByProtocolId; }
    public String getReplacementReason() { return replacementReason; }
    public void setReplacementReason(String replacementReason) { this.replacementReason = replacementReason; }
    public String getPdfSha256() { return pdfSha256; }
    public void setPdfSha256(String pdfSha256) { this.pdfSha256 = pdfSha256; }
    public String getSignatureCertificateMetadata() { return signatureCertificateMetadata; }
    public void setSignatureCertificateMetadata(String signatureCertificateMetadata) { this.signatureCertificateMetadata = signatureCertificateMetadata; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    public Long getPublishedBy() { return publishedBy; }
    public void setPublishedBy(Long publishedBy) { this.publishedBy = publishedBy; }
    public Long getPekProgramId() { return pekProgramId; }
    public void setPekProgramId(Long pekProgramId) { this.pekProgramId = pekProgramId; }
    public Long getPekReportId() { return pekReportId; }
    public void setPekReportId(Long pekReportId) { this.pekReportId = pekReportId; }
    public Long getPekControlItemId() { return pekControlItemId; }
    public void setPekControlItemId(Long pekControlItemId) { this.pekControlItemId = pekControlItemId; }
    public Long getPekControlEventId() { return pekControlEventId; }
    public void setPekControlEventId(Long pekControlEventId) { this.pekControlEventId = pekControlEventId; }
    public Long getMonitoringPointId() { return monitoringPointId; }
    public void setMonitoringPointId(Long monitoringPointId) { this.monitoringPointId = monitoringPointId; }
    public Long getEmissionSourceId() { return emissionSourceId; }
    public void setEmissionSourceId(Long emissionSourceId) { this.emissionSourceId = emissionSourceId; }
    public Long getWaterOutletId() { return waterOutletId; }
    public void setWaterOutletId(Long waterOutletId) { this.waterOutletId = waterOutletId; }
    public String getInstrumentsJson() { return instrumentsJson; }
    public void setInstrumentsJson(String instrumentsJson) { this.instrumentsJson = instrumentsJson; }
    public String getPrintVisibilityJson() { return printVisibilityJson; }
    public void setPrintVisibilityJson(String printVisibilityJson) { this.printVisibilityJson = printVisibilityJson; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
