package kz.eco.services;

import jakarta.persistence.*;
import kz.eco.content.ContentStatus;
import kz.eco.content.FaqItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "eco_services")
public class EcoService {

    @Id
    @Column(length = 80)
    private String id;

    @Column(length = 40)
    private String businessCompanyId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ServiceCategory category;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 80)
    private String slug;

    @Column(nullable = false, length = 1000)
    private String description;

    @Column(length = 800)
    private String forWhom;

    @Column(length = 800)
    private String result;

    @Column(length = 100)
    private String duration;

    @Column(length = 80)
    private String icon;

    private BigDecimal basePrice;

    private Integer durationDays;

    @Column(nullable = false)
    private boolean isActive = true;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_includes", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> includes = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_documents", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> documents = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_workflow", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> workflow = new ArrayList<>();

    /** Unified CMS workflow status (kz.eco.content.ContentStatus) - retrofitted onto the catalogue
     *  so services go through the same review pipeline as articles/region pages. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentStatus contentStatus = ContentStatus.PUBLISHED;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    private Instant reviewedAt;

    /** Optimistic locking - required on every mutating call; a stale value surfaces as 409
     *  VERSION_CONFLICT, never a silent overwrite (see kz.eco.content.ContentVersioning). */
    @Version
    private Long version;

    // ---- AEO (Answer-Engine-Optimization) structured blocks --------------------------------
    // Deliberately structured fields, not one big HTML/string blob, so the frontend can render
    // each block distinctly (and an AI answer engine can extract a single fact rather than having
    // to parse free-form markup) - see module fix item 1.

    /** One or two sentences that directly answer "what is this service" - the literal AEO
     *  "featured snippet" answer, rendered as real visible HTML on the page, not just JSON-LD. */
    @Column(name = "short_answer", length = 500)
    private String shortAnswer;

    @Column(name = "who_needs", length = 1000)
    private String whoNeeds;

    @Column(name = "when_required", length = 1000)
    private String whenRequired;

    @Column(name = "when_not_required", length = 1000)
    private String whenNotRequired;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_required_documents", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> requiredDocuments = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_customer_receives", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> customerReceives = new ArrayList<>();

    @Column(name = "timeline", length = 500)
    private String timeline;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_pricing_factors", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> pricingFactors = new ArrayList<>();

    /** References to the actual legal acts/normatives the service is grounded in - required for
     *  E-E-A-T/trust, not decorative. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_legal_basis", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> legalBasis = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_common_mistakes", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> commonMistakes = new ArrayList<>();

    /** Real user-facing FAQ (not padding for schema count) - also drives the FAQPage JSON-LD, but
     *  the questions themselves must earn their place on the visible page first. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eco_service_faq", joinColumns = @JoinColumn(name = "service_id"))
    @OrderColumn(name = "ord")
    private List<FaqItem> faq = new ArrayList<>();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    /** Only APPROVED/PUBLISHED services may be publicly indexed - same rule as News/ServiceCityPage. */
    public boolean isIndexable() {
        return isActive && (contentStatus == ContentStatus.APPROVED || contentStatus == ContentStatus.PUBLISHED);
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getBusinessCompanyId() { return businessCompanyId; }
    public void setBusinessCompanyId(String businessCompanyId) { this.businessCompanyId = businessCompanyId; }
    public ServiceCategory getCategory() { return category; }
    public void setCategory(ServiceCategory category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getForWhom() { return forWhom; }
    public void setForWhom(String forWhom) { this.forWhom = forWhom; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public BigDecimal getBasePrice() { return basePrice; }
    public void setBasePrice(BigDecimal basePrice) { this.basePrice = basePrice; }
    public Integer getDurationDays() { return durationDays; }
    public void setDurationDays(Integer durationDays) { this.durationDays = durationDays; }
    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<String> getIncludes() { return includes; }
    public void setIncludes(List<String> includes) { this.includes = includes; }
    public List<String> getDocuments() { return documents; }
    public void setDocuments(List<String> documents) { this.documents = documents; }
    public List<String> getWorkflow() { return workflow; }
    public void setWorkflow(List<String> workflow) { this.workflow = workflow; }
    public ContentStatus getContentStatus() { return contentStatus; }
    public void setContentStatus(ContentStatus contentStatus) { this.contentStatus = contentStatus; }
    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public Long getVersion() { return version; }
    public String getShortAnswer() { return shortAnswer; }
    public void setShortAnswer(String shortAnswer) { this.shortAnswer = shortAnswer; }
    public String getWhoNeeds() { return whoNeeds; }
    public void setWhoNeeds(String whoNeeds) { this.whoNeeds = whoNeeds; }
    public String getWhenRequired() { return whenRequired; }
    public void setWhenRequired(String whenRequired) { this.whenRequired = whenRequired; }
    public String getWhenNotRequired() { return whenNotRequired; }
    public void setWhenNotRequired(String whenNotRequired) { this.whenNotRequired = whenNotRequired; }
    public List<String> getRequiredDocuments() { return requiredDocuments; }
    public void setRequiredDocuments(List<String> requiredDocuments) { this.requiredDocuments = requiredDocuments; }
    public List<String> getCustomerReceives() { return customerReceives; }
    public void setCustomerReceives(List<String> customerReceives) { this.customerReceives = customerReceives; }
    public String getTimeline() { return timeline; }
    public void setTimeline(String timeline) { this.timeline = timeline; }
    public List<String> getPricingFactors() { return pricingFactors; }
    public void setPricingFactors(List<String> pricingFactors) { this.pricingFactors = pricingFactors; }
    public List<String> getLegalBasis() { return legalBasis; }
    public void setLegalBasis(List<String> legalBasis) { this.legalBasis = legalBasis; }
    public List<String> getCommonMistakes() { return commonMistakes; }
    public void setCommonMistakes(List<String> commonMistakes) { this.commonMistakes = commonMistakes; }
    public List<FaqItem> getFaq() { return faq; }
    public void setFaq(List<FaqItem> faq) { this.faq = faq; }
}
