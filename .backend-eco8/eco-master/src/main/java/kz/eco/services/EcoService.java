package kz.eco.services;

import jakarta.persistence.*;
import java.math.BigDecimal;
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

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

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
}
