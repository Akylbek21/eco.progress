package kz.eco.order;

import jakarta.persistence.*;
import kz.eco.user.User;
import java.time.LocalDateTime;

@Entity
@Table(name = "order_comments", indexes = {
    @Index(name = "idx_oc_order", columnList = "order_id"),
    @Index(name = "idx_oc_quarter", columnList = "order_quarter_id")
})
public class OrderComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_quarter_id")
    private OrderQuarter orderQuarter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_user_id")
    private User authorUser;

    @Column(nullable = false, length = 200)
    private String authorName;

    @Column(nullable = false, length = 30)
    private String authorRole;

    @Column(nullable = false, length = 4000)
    private String text;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CommentVisibility visibility = CommentVisibility.client;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public OrderQuarter getOrderQuarter() { return orderQuarter; }
    public void setOrderQuarter(OrderQuarter orderQuarter) { this.orderQuarter = orderQuarter; }
    public User getAuthorUser() { return authorUser; }
    public void setAuthorUser(User authorUser) { this.authorUser = authorUser; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getAuthorRole() { return authorRole; }
    public void setAuthorRole(String authorRole) { this.authorRole = authorRole; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public CommentVisibility getVisibility() { return visibility; }
    public void setVisibility(CommentVisibility visibility) { this.visibility = visibility; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
