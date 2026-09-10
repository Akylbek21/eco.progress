package kz.eco.geo;

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
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** GEO Query Monitor entry (Analytics item 3) - a curated real query whose visibility in
 *  Google/ChatGPT/etc is checked and recorded here. Deliberately no automated scraper is built
 *  against this entity: {@link #lastCheckedAt}/{@link #ourBrandMentioned}/{@link #ourUrlCited}/
 *  {@link #competitors} are only ever written by a human check or an explicitly allowed API
 *  integration (e.g. Search Console's generative-AI report, once available) - see
 *  GeoMonitoredQueryService#recordCheck. */
@Entity
@Table(name = "geo_monitored_query")
public class GeoMonitoredQuery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String query;

    @Column(length = 80)
    private String category;

    @Column(name = "service_id", length = 80)
    private String serviceId;

    @Column(name = "city_slug", length = 60)
    private String citySlug;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private QueryIntent intent;

    private Instant lastCheckedAt;

    private boolean ourBrandMentioned;

    private boolean ourUrlCited;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "geo_monitored_query_competitors", joinColumns = @JoinColumn(name = "query_id"))
    @OrderColumn(name = "ord")
    @Column(name = "competitor", length = 200)
    private List<String> competitors = new ArrayList<>();

    @Column(name = "checked_by")
    private Long checkedBy;

    @Version
    private Long version;

    public Long getId() { return id; }
    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    public String getCitySlug() { return citySlug; }
    public void setCitySlug(String citySlug) { this.citySlug = citySlug; }
    public QueryIntent getIntent() { return intent; }
    public void setIntent(QueryIntent intent) { this.intent = intent; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(Instant lastCheckedAt) { this.lastCheckedAt = lastCheckedAt; }
    public boolean isOurBrandMentioned() { return ourBrandMentioned; }
    public void setOurBrandMentioned(boolean ourBrandMentioned) { this.ourBrandMentioned = ourBrandMentioned; }
    public boolean isOurUrlCited() { return ourUrlCited; }
    public void setOurUrlCited(boolean ourUrlCited) { this.ourUrlCited = ourUrlCited; }
    public List<String> getCompetitors() { return competitors; }
    public void setCompetitors(List<String> competitors) { this.competitors = competitors; }
    public Long getCheckedBy() { return checkedBy; }
    public void setCheckedBy(Long checkedBy) { this.checkedBy = checkedBy; }
    public Long getVersion() { return version; }
}
