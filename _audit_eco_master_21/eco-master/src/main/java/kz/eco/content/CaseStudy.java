package kz.eco.content;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** A real, published client engagement writeup - not a template with the city name swapped.
 *  Publication requires the same unified CMS review gate as every other content type (see
 *  ContentStatus, isIndexable()): "публикация только после экспертной проверки" is enforced by
 *  CaseStudyService#requireReviewed exactly like News/EcoService/ServiceCityPage. Optionally
 *  linked to a service and/or city so ServiceCityPage/EcoService can surface it as a relevant
 *  case (see CaseStudyRepository#findAllByServiceIdOrCitySlug). */
@Entity
@Table(name = "content_case_studies")
public class CaseStudy {

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 240)
    private String title;

    @Column(nullable = false, length = 600)
    private String summary;

    /** Free text, deliberately not a strict FK to a real Company row - case studies are usually
     *  written up anonymized/generalized ("Промышленное предприятие, Караганда") rather than
     *  naming the actual client. */
    @Column(name = "client_label", length = 300)
    private String clientLabel;

    @Column(name = "service_id", length = 80)
    private String serviceId;

    @Column(name = "city_slug", length = 60)
    private String citySlug;

    /** Industry sector, e.g. "Горнодобывающая промышленность". Used for schema.org CaseStudy and FE filters. */
    @Column(length = 200)
    private String industry;

    /** Type of regulated object, e.g. "Стационарный источник выбросов". */
    @Column(name = "object_type", length = 200)
    private String objectType;

    /** Date this case study was formally published/released. Distinct from updatedAt (editorial). */
    @Column(name = "published_at")
    private LocalDate publishedAt;

    @Column(length = 4000)
    private String challenge;

    @Column(length = 4000)
    private String solution;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "content_case_study_results", joinColumns = @JoinColumn(name = "case_slug"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> results = new ArrayList<>();

    @Column(length = 300)
    private String image;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentStatus contentStatus = ContentStatus.DRAFT;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    private Instant reviewedAt;
    private Instant createdAt;
    private Instant updatedAt;

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

    public boolean isIndexable() {
        return contentStatus == ContentStatus.APPROVED || contentStatus == ContentStatus.PUBLISHED;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getClientLabel() { return clientLabel; }
    public void setClientLabel(String clientLabel) { this.clientLabel = clientLabel; }
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    public String getCitySlug() { return citySlug; }
    public void setCitySlug(String citySlug) { this.citySlug = citySlug; }
    public String getIndustry() { return industry; }
    public void setIndustry(String industry) { this.industry = industry; }
    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public LocalDate getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDate publishedAt) { this.publishedAt = publishedAt; }
    public String getChallenge() { return challenge; }
    public void setChallenge(String challenge) { this.challenge = challenge; }
    public String getSolution() { return solution; }
    public void setSolution(String solution) { this.solution = solution; }
    public List<String> getResults() { return results; }
    public void setResults(List<String> results) { this.results = results; }
    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }
    public ContentStatus getContentStatus() { return contentStatus; }
    public void setContentStatus(ContentStatus contentStatus) { this.contentStatus = contentStatus; }
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
