package kz.ecoprogress.documentflow.membership;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "document_flow_membership_invitations",
        uniqueConstraints = @UniqueConstraint(name = "uk_df_membership_invitation_token", columnNames = "token_hash"))
public class MembershipInvitation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id", nullable=false) private Long organizationId;
    @Column(name="membership_id", nullable=false) private Long membershipId;
    @Column(name="user_id", nullable=false) private Long userId;
    @Column(nullable=false, length=160) private String email;
    @Column(name="token_hash", nullable=false, length=64) private String tokenHash;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20)
    private MembershipInvitationStatus status = MembershipInvitationStatus.INVITED;
    @Column(name="expires_at", nullable=false) private LocalDateTime expiresAt;
    @Column(name="invited_by") private Long invitedBy;
    @Column(name="accepted_at") private LocalDateTime acceptedAt;
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt = LocalDateTime.now();
    @Version private Long version;
    public Long getId(){return id;} public Long getOrganizationId(){return organizationId;}
    public void setOrganizationId(Long v){organizationId=v;} public Long getMembershipId(){return membershipId;}
    public void setMembershipId(Long v){membershipId=v;} public Long getUserId(){return userId;}
    public void setUserId(Long v){userId=v;} public String getEmail(){return email;} public void setEmail(String v){email=v;}
    public String getTokenHash(){return tokenHash;} public void setTokenHash(String v){tokenHash=v;}
    public MembershipInvitationStatus getStatus(){return status;} public void setStatus(MembershipInvitationStatus v){status=v;}
    public LocalDateTime getExpiresAt(){return expiresAt;} public void setExpiresAt(LocalDateTime v){expiresAt=v;}
    public Long getInvitedBy(){return invitedBy;} public void setInvitedBy(Long v){invitedBy=v;}
    public LocalDateTime getAcceptedAt(){return acceptedAt;} public void setAcceptedAt(LocalDateTime v){acceptedAt=v;}
    public Long getVersion(){return version;}
}
