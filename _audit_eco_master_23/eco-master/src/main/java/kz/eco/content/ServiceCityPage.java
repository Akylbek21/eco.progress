package kz.eco.content;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Programmatic "service in city" landing page (e.g. "экологическая экспертиза в Семее") - a
 *  region/content-CMS entity, workflow-shaped exactly like kz.eco.news.News: a single unified
 *  {@link ContentStatus}, not a bespoke pair of statuses, so every content type in this CMS
 *  behaves identically to editors and to the version/If-Match contract. */
@Entity
@Table(name = "service_city_pages",
        uniqueConstraints = @UniqueConstraint(name = "uk_service_city", columnNames = {"service_id", "city_slug"}))
public class ServiceCityPage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_id", nullable = false, length = 80)
    private String serviceId;

    @Column(name = "city_slug", nullable = false, length = 60)
    private String citySlug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentStatus contentStatus = ContentStatus.DRAFT;

    /** Result of the last ServiceCityContentQualityService run - only ever set by that service,
     *  never accepted as client input. approve()/publish() re-run the check and refuse to proceed
     *  if it comes back false, so this field can never go stale in a way that lets a failing page
     *  become indexable (see ServiceCityPageService#requireQualityPassed). */
    @Column(nullable = false)
    private boolean contentQualityPassed = false;

    /** Human-readable reasons the last quality check failed - surfaced to editors, cleared on a
     *  passing run. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_city_quality_issues", joinColumns = @JoinColumn(name = "page_id"))
    @OrderColumn(name = "ord")
    @Column(name = "issue", length = 500)
    private List<String> qualityIssues = new ArrayList<>();

    /** Unique regional paragraphs - must reference the city by its correctly-declined form(s), not
     *  just its name, and must not be near-duplicate of another page's (see quality service). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_city_regional_blocks", joinColumns = @JoinColumn(name = "page_id"))
    @OrderColumn(name = "ord")
    @Column(name = "block_text", length = 4000)
    private List<String> regionalBlocks = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_city_faq", joinColumns = @JoinColumn(name = "page_id"))
    @OrderColumn(name = "ord")
    private List<FaqItem> localFaq = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_city_cases", joinColumns = @JoinColumn(name = "page_id"))
    @OrderColumn(name = "ord")
    @Column(name = "case_text", length = 2000)
    private List<String> cases = new ArrayList<>();

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    private Instant reviewedAt;
    private Instant createdAt;
    private Instant updatedAt;

    /** Optimistic locking - required on every mutating call; a stale value surfaces as 409
     *  VERSION_CONFLICT, never a silent overwrite (see kz.eco.content.ContentVersioning). */
    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    /** The one place all the publish gates are combined: PUBLISHED status + APPROVED-reviewed
     *  content (reviewerId/reviewedAt are only ever set by approve(), see ServiceCityPageService)
     *  + a passing automated quality check. */
    public boolean isIndexable() {
        return contentStatus == ContentStatus.PUBLISHED && contentQualityPassed
                && reviewerId != null && reviewedAt != null;
    }

    public Long getId() { return id; }
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    public String getCitySlug() { return citySlug; }
    public void setCitySlug(String citySlug) { this.citySlug = citySlug; }
    public ContentStatus getContentStatus() { return contentStatus; }
    public void setContentStatus(ContentStatus contentStatus) { this.contentStatus = contentStatus; }
    public boolean isContentQualityPassed() { return contentQualityPassed; }
    public void setContentQualityPassed(boolean contentQualityPassed) { this.contentQualityPassed = contentQualityPassed; }
    public List<String> getQualityIssues() { return qualityIssues; }
    public void setQualityIssues(List<String> qualityIssues) { this.qualityIssues = qualityIssues; }
    public List<String> getRegionalBlocks() { return regionalBlocks; }
    public void setRegionalBlocks(List<String> regionalBlocks) { this.regionalBlocks = regionalBlocks; }
    public List<FaqItem> getLocalFaq() { return localFaq; }
    public void setLocalFaq(List<FaqItem> localFaq) { this.localFaq = localFaq; }
    public List<String> getCases() { return cases; }
    public void setCases(List<String> cases) { this.cases = cases; }
    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
