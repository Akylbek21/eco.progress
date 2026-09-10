package kz.eco.geo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/** One recorded period of GEO/AI-referral traffic for a single (source, landingPage) pair
 *  (Analytics item 2). Fed manually or via an allowed API integration (e.g. GA4/GSC export) - this
 *  entity is a data sink, not a scraper. */
@Entity
@Table(name = "geo_referral_event")
public class GeoReferralEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private GeoReferralSource source;

    @Column(length = 80)
    private String medium;

    @Column(name = "landing_page", nullable = false, length = 500)
    private String landingPage;

    private int sessions;
    private int conversions;
    private int leadCount;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "recorded_by")
    private Long recordedBy;

    private Instant recordedAt;

    public Long getId() { return id; }
    public GeoReferralSource getSource() { return source; }
    public void setSource(GeoReferralSource source) { this.source = source; }
    public String getMedium() { return medium; }
    public void setMedium(String medium) { this.medium = medium; }
    public String getLandingPage() { return landingPage; }
    public void setLandingPage(String landingPage) { this.landingPage = landingPage; }
    public int getSessions() { return sessions; }
    public void setSessions(int sessions) { this.sessions = sessions; }
    public int getConversions() { return conversions; }
    public void setConversions(int conversions) { this.conversions = conversions; }
    public int getLeadCount() { return leadCount; }
    public void setLeadCount(int leadCount) { this.leadCount = leadCount; }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    public Long getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Long recordedBy) { this.recordedBy = recordedBy; }
    public Instant getRecordedAt() { return recordedAt; }
    public void setRecordedAt(Instant recordedAt) { this.recordedAt = recordedAt; }
}
