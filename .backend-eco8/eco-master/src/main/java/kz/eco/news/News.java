package kz.eco.news;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

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
}
