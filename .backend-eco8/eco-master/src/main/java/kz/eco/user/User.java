package kz.eco.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(nullable = false, length = 200)
    private String passwordHash;

    @Column(length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role = UserRole.CLIENT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.active;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClientType type = ClientType.individual;

    @Column(length = 80)
    private String city;

    @Column(length = 200)
    private String companyName;

    @Column(length = 20)
    private String bin;

    @Column(length = 80)
    private String organizationType;

    @Column(length = 300)
    private String legalAddress;

    @Column(length = 120)
    private String position;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    private LocalDateTime lastLoginAt;

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }
    public UserStatus getStatus() { return status; }
    public void setStatus(UserStatus status) { this.status = status; }
    public ClientType getType() { return type; }
    public void setType(ClientType type) { this.type = type; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getBin() { return bin; }
    public void setBin(String bin) { this.bin = bin; }
    public String getOrganizationType() { return organizationType; }
    public void setOrganizationType(String organizationType) { this.organizationType = organizationType; }
    public String getLegalAddress() { return legalAddress; }
    public void setLegalAddress(String legalAddress) { this.legalAddress = legalAddress; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}
