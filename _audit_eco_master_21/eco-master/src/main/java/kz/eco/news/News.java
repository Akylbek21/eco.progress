package kz.eco.news;

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
import kz.eco.content.ContentStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "news")
public class News {

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 240)
    private String title;

    @Column(nullable = false, length = 600)
    private String excerpt;

    @Column(length = 80)
    private String category;

    @Column(nullable = false)
    private LocalDate publishedAt;

    @Column(length = 300)
    private String image;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "news_content", joinColumns = @JoinColumn(name = "news_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 2000)
    private List<String> content = new ArrayList<>();

    /** Cited sources (URLs or descriptive text) for the article - rendered as visible <cite>
     *  elements on the page and included in Article JSON-LD as citation nodes. Empty for articles
     *  that predate this field (legacy rows, no backfill needed). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "news_sources", joinColumns = @JoinColumn(name = "news_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 600)
    private List<String> sources = new ArrayList<>();

    /** Unified CMS workflow status (kz.eco.content.ContentStatus) - never settable from a public
     *  request payload; only mutated via the review-transition service methods so that "index"
     *  can never be forced true by the frontend without going through APPROVED+PUBLISHED. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContentStatus reviewStatus = ContentStatus.DRAFT;

    /** Author (kz.eco.user.User.id) - set to the first submitter on submitForReview() if not
     *  already assigned. Nullable for legacy rows created before this field existed. */
    @Column(name = "author_id")
    private Long authorId;

    /** Reviewer (kz.eco.user.User.id) who approved the article - set on approve(). Left in place
     *  (not cleared) if approval is later revoked, so the DTO can still show who last reviewed it. */
    @Column(name = "reviewer_id")
    private Long reviewerId;

    private Instant reviewedAt;

    private Instant createdAt;

    private Instant updatedAt;

    /** Optimistic locking - required on every mutating call (submit/approve/publish/return/
     *  revoke/archive); a stale value surfaces as 409 VERSION_CONFLICT, never a silent overwrite. */
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

    /** Only APPROVED/PUBLISHED material may be publicly indexed - the single source of truth the
     *  public DTO's robots directive and the sitemap generator both read from. */
    public boolean isIndexable() {
        return reviewStatus == ContentStatus.APPROVED || reviewStatus == ContentStatus.PUBLISHED;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String excerpt) { this.excerpt = excerpt; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public LocalDate getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDate publishedAt) { this.publishedAt = publishedAt; }
    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }
    public List<String> getContent() { return content; }
    public void setContent(List<String> content) { this.content = content; }
    public List<String> getSources() { return sources; }
    public void setSources(List<String> sources) { this.sources = sources; }
    public ContentStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ContentStatus reviewStatus) { this.reviewStatus = reviewStatus; }
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
