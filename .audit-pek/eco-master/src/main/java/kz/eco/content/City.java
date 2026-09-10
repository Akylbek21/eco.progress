package kz.eco.content;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** City catalog with explicit Russian grammatical case forms. Deliberately NOT auto-derived by a
 *  suffix rule - Kazakhstani toponym declension is irregular/exception-heavy (e.g. Семей -&gt; в
 *  Семее, из Семея; Алматы/Актобе are indeclinable) and a naive "+е"/"+а" generator would silently
 *  produce wrong grammar across dozens of pages. Every form here is an explicit editorial value. */
@Entity
@Table(name = "content_cities")
public class City {

    @Id
    @Column(length = 60)
    private String slug;

    /** Именительный: "кто/что" - Семей, Алматы. */
    @Column(nullable = false, length = 80)
    private String nominative;

    /** Родительный: "нет кого/чего", "из ..." - Семея, Алматы. */
    @Column(nullable = false, length = 80)
    private String genitive;

    /** Дательный: "к ...", "по ..." - Семею, Алматы. */
    @Column(nullable = false, length = 80)
    private String dative;

    /** Винительный: "вижу ..." - Семей, Алматы. */
    @Column(nullable = false, length = 80)
    private String accusative;

    /** Творительный: "с ...", "перед ..." - Семеем, Алматы. */
    @Column(nullable = false, length = 80)
    private String instrumental;

    /** Предложный: "в ...", "о ..." - Семее, Алматы. */
    @Column(nullable = false, length = 80)
    private String prepositional;

    @Column(length = 120)
    private String regionName;

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getNominative() { return nominative; }
    public void setNominative(String nominative) { this.nominative = nominative; }
    public String getGenitive() { return genitive; }
    public void setGenitive(String genitive) { this.genitive = genitive; }
    public String getDative() { return dative; }
    public void setDative(String dative) { this.dative = dative; }
    public String getAccusative() { return accusative; }
    public void setAccusative(String accusative) { this.accusative = accusative; }
    public String getInstrumental() { return instrumental; }
    public void setInstrumental(String instrumental) { this.instrumental = instrumental; }
    public String getPrepositional() { return prepositional; }
    public void setPrepositional(String prepositional) { this.prepositional = prepositional; }
    public String getRegionName() { return regionName; }
    public void setRegionName(String regionName) { this.regionName = regionName; }
}
