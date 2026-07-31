package kz.eco.normative;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pollutant_code_groups")
public class PollutantCodeGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String groupCode;

    @Column(length = 300)
    private String groupName;

    @Column(length = 20)
    private String codeFrom;

    @Column(length = 20)
    private String codeTo;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 200)
    private String sourceFile;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getGroupCode() { return groupCode; }
    public void setGroupCode(String groupCode) { this.groupCode = groupCode; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public String getCodeFrom() { return codeFrom; }
    public void setCodeFrom(String codeFrom) { this.codeFrom = codeFrom; }
    public String getCodeTo() { return codeTo; }
    public void setCodeTo(String codeTo) { this.codeTo = codeTo; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getSourceFile() { return sourceFile; }
    public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
