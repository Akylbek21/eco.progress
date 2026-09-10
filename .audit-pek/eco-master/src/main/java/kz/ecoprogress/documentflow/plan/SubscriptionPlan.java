package kz.ecoprogress.documentflow.plan;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "subscription_plans", uniqueConstraints = @UniqueConstraint(name = "uk_subscription_plans_code", columnNames = "code"))
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 200)
    private String nameRu;

    @Column(nullable = false, length = 200)
    private String nameKk;

    @Column(length = 2000)
    private String descriptionRu;

    @Column(length = 2000)
    private String descriptionKk;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BillingPeriod billingPeriod;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 8)
    private String currency = "KZT";

    @Column(nullable = false)
    private int trialDays = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean visible = true;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameRu() { return nameRu; }
    public void setNameRu(String nameRu) { this.nameRu = nameRu; }
    public String getNameKk() { return nameKk; }
    public void setNameKk(String nameKk) { this.nameKk = nameKk; }
    public String getDescriptionRu() { return descriptionRu; }
    public void setDescriptionRu(String descriptionRu) { this.descriptionRu = descriptionRu; }
    public String getDescriptionKk() { return descriptionKk; }
    public void setDescriptionKk(String descriptionKk) { this.descriptionKk = descriptionKk; }
    public BillingPeriod getBillingPeriod() { return billingPeriod; }
    public void setBillingPeriod(BillingPeriod billingPeriod) { this.billingPeriod = billingPeriod; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public int getTrialDays() { return trialDays; }
    public void setTrialDays(int trialDays) { this.trialDays = trialDays; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
