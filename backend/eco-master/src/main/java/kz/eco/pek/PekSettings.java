package kz.eco.pek;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pek_settings", uniqueConstraints =
        @UniqueConstraint(name = "uk_pek_settings_company", columnNames = "company_id"))
public class PekSettings {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id", nullable = false)
    private Long companyId;
    @Column(name = "default_responsible_user_id") private Long defaultResponsibleUserId;
    /** Pre-fills the laboratory field when a user manually creates a new protocol for this company -
     *  a UI convenience default only. Deliberately NOT read anywhere in the auto-collection path
     *  ({@link PekReportCollectionService#collect}, {@link PekProtocolEligibilityService}): it says
     *  nothing about which already-existing protocols should be eligible for a report, and using it
     *  to filter collect() would silently exclude real evidence from other laboratories. If a future
     *  requirement needs auto-collect restricted to one laboratory, that must be a distinct, clearly
     *  named setting (e.g. autoCollectLaboratoryId) - not this field repurposed. */
    @Column(name = "default_laboratory_id") private Long defaultLaboratoryId;
    @Enumerated(EnumType.STRING) @Column(name = "default_report_type", nullable = false, length = 20)
    private PekSettingsReportType defaultReportType = PekSettingsReportType.QUARTERLY;
    @Column(name = "auto_collect_protocols", nullable = false) private boolean autoCollectProtocols;
    @Column(name = "include_only_signed_protocols", nullable = false) private boolean includeOnlySignedProtocols = true;
    @Column(name = "allow_fallback_matching", nullable = false) private boolean allowFallbackMatching = true;
    @Column(name = "require_manual_ambiguous_confirmation", nullable = false) private boolean requireManualAmbiguousConfirmation = true;
    @Column(name = "require_all_plan_fact_items", nullable = false) private boolean requireAllPlanFactItems = true;
    @Column(name = "block_submit_with_unmatched_results", nullable = false) private boolean blockSubmitWithUnmatchedResults = true;
    @Column(name = "block_submit_with_ambiguous_results", nullable = false) private boolean blockSubmitWithAmbiguousResults = true;
    @Column(name = "block_submit_with_stale_sources", nullable = false) private boolean blockSubmitWithStaleSources = true;
    @Column(name = "block_submit_with_open_exceedances", nullable = false) private boolean blockSubmitWithOpenExceedances = true;
    @Column(name = "notify_before_deadline_days", nullable = false) private int notifyBeforeDeadlineDays = 7;
    @Column(name = "notify_missing_protocols", nullable = false) private boolean notifyMissingProtocols = true;
    @Column(name = "notify_exceedances", nullable = false) private boolean notifyExceedances = true;
    @Column(name = "notify_report_returned", nullable = false) private boolean notifyReportReturned = true;
    @Version @Column(nullable = false) private Long version;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @Column(name = "created_by", nullable = false) private Long createdBy;
    @Column(name = "updated_by", nullable = false) private Long updatedBy;

    @PrePersist void createTimestamps() { LocalDateTime now=LocalDateTime.now(); createdAt=now; updatedAt=now; }
    @PreUpdate void updateTimestamp() { updatedAt=LocalDateTime.now(); }
    public Long getId(){return id;} public Long getCompanyId(){return companyId;} public void setCompanyId(Long v){companyId=v;}
    public Long getDefaultResponsibleUserId(){return defaultResponsibleUserId;} public void setDefaultResponsibleUserId(Long v){defaultResponsibleUserId=v;}
    public Long getDefaultLaboratoryId(){return defaultLaboratoryId;} public void setDefaultLaboratoryId(Long v){defaultLaboratoryId=v;}
    public PekSettingsReportType getDefaultReportType(){return defaultReportType;} public void setDefaultReportType(PekSettingsReportType v){defaultReportType=v;}
    public boolean isAutoCollectProtocols(){return autoCollectProtocols;} public void setAutoCollectProtocols(boolean v){autoCollectProtocols=v;}
    public boolean isIncludeOnlySignedProtocols(){return includeOnlySignedProtocols;} public void setIncludeOnlySignedProtocols(boolean v){includeOnlySignedProtocols=v;}
    public boolean isAllowFallbackMatching(){return allowFallbackMatching;} public void setAllowFallbackMatching(boolean v){allowFallbackMatching=v;}
    public boolean isRequireManualAmbiguousConfirmation(){return requireManualAmbiguousConfirmation;} public void setRequireManualAmbiguousConfirmation(boolean v){requireManualAmbiguousConfirmation=v;}
    public boolean isRequireAllPlanFactItems(){return requireAllPlanFactItems;} public void setRequireAllPlanFactItems(boolean v){requireAllPlanFactItems=v;}
    public boolean isBlockSubmitWithUnmatchedResults(){return blockSubmitWithUnmatchedResults;} public void setBlockSubmitWithUnmatchedResults(boolean v){blockSubmitWithUnmatchedResults=v;}
    public boolean isBlockSubmitWithAmbiguousResults(){return blockSubmitWithAmbiguousResults;} public void setBlockSubmitWithAmbiguousResults(boolean v){blockSubmitWithAmbiguousResults=v;}
    public boolean isBlockSubmitWithStaleSources(){return blockSubmitWithStaleSources;} public void setBlockSubmitWithStaleSources(boolean v){blockSubmitWithStaleSources=v;}
    public boolean isBlockSubmitWithOpenExceedances(){return blockSubmitWithOpenExceedances;} public void setBlockSubmitWithOpenExceedances(boolean v){blockSubmitWithOpenExceedances=v;}
    public int getNotifyBeforeDeadlineDays(){return notifyBeforeDeadlineDays;} public void setNotifyBeforeDeadlineDays(int v){notifyBeforeDeadlineDays=v;}
    public boolean isNotifyMissingProtocols(){return notifyMissingProtocols;} public void setNotifyMissingProtocols(boolean v){notifyMissingProtocols=v;}
    public boolean isNotifyExceedances(){return notifyExceedances;} public void setNotifyExceedances(boolean v){notifyExceedances=v;}
    public boolean isNotifyReportReturned(){return notifyReportReturned;} public void setNotifyReportReturned(boolean v){notifyReportReturned=v;}
    public Long getVersion(){return version;} public LocalDateTime getCreatedAt(){return createdAt;} public LocalDateTime getUpdatedAt(){return updatedAt;}
    public Long getCreatedBy(){return createdBy;} public void setCreatedBy(Long v){createdBy=v;} public Long getUpdatedBy(){return updatedBy;} public void setUpdatedBy(Long v){updatedBy=v;}
}
