package kz.eco.client;

import jakarta.persistence.*;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import java.time.LocalDateTime;

@Entity
@Table(name = "clients")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClientType clientType = ClientType.company;

    @Column(length = 200)
    private String companyName;

    @Column(length = 20)
    private String binIin;

    @Column(length = 400)
    private String legalAddress;

    @Column(length = 400)
    private String actualAddress;

    @Column(length = 200)
    private String contactPerson;

    @Column(length = 40)
    private String phone;

    @Column(length = 160)
    private String email;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public ClientType getClientType() { return clientType; }
    public void setClientType(ClientType clientType) { this.clientType = clientType; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getBinIin() { return binIin; }
    public void setBinIin(String binIin) { this.binIin = binIin; }
    public String getLegalAddress() { return legalAddress; }
    public void setLegalAddress(String legalAddress) { this.legalAddress = legalAddress; }
    public String getActualAddress() { return actualAddress; }
    public void setActualAddress(String actualAddress) { this.actualAddress = actualAddress; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
