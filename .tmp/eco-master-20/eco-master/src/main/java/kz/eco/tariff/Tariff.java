package kz.eco.tariff;

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
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tariffs")
public class Tariff {

    @Id
    @Column(length = 80)
    private String id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 100)
    private String price;

    @Column(length = 1000)
    private String description;

    @Column(length = 200)
    private String cta;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TariffMode mode;

    @Column(nullable = false)
    private boolean popular;

    @Column(nullable = false)
    private int sortOrder;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "tariff_features", joinColumns = @JoinColumn(name = "tariff_id"))
    @OrderColumn(name = "ord")
    @Column(name = "item_value", length = 400)
    private List<String> features = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPrice() { return price; }
    public void setPrice(String price) { this.price = price; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCta() { return cta; }
    public void setCta(String cta) { this.cta = cta; }
    public TariffMode getMode() { return mode; }
    public void setMode(TariffMode mode) { this.mode = mode; }
    public boolean isPopular() { return popular; }
    public void setPopular(boolean popular) { this.popular = popular; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public List<String> getFeatures() { return features; }
    public void setFeatures(List<String> features) { this.features = features; }
}
