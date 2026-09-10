package kz.ecoprogress.documentflow.membership;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.signing.Sha256Util;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class MembershipInvitationService {
    public record Created(MembershipInvitation invitation, String rawToken) {}
    private static final String ENTITY_TYPE = "DocumentFlowMembership";
    private final MembershipInvitationRepository invitationRepository;
    private final DocumentFlowMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public MembershipInvitationService(MembershipInvitationRepository invitationRepository,
                                       DocumentFlowMembershipRepository membershipRepository,
                                       UserRepository userRepository, PasswordEncoder passwordEncoder,
                                       AuditLogService auditLogService) {
        this.invitationRepository=invitationRepository; this.membershipRepository=membershipRepository;
        this.userRepository=userRepository; this.passwordEncoder=passwordEncoder;
        this.auditLogService=auditLogService;
    }

    @Transactional
    public Created create(DocumentFlowMembership membership, User user, Long actorId) {
        invitationRepository.findFirstByOrganizationIdAndUserIdAndStatusOrderByCreatedAtDesc(
                membership.getOrganizationId(), user.getId(), MembershipInvitationStatus.INVITED)
                .ifPresent(old -> { old.setStatus(MembershipInvitationStatus.REVOKED); invitationRepository.save(old); });
        String token = Sha256Util.generateToken();
        MembershipInvitation row = new MembershipInvitation();
        row.setOrganizationId(membership.getOrganizationId()); row.setMembershipId(membership.getId());
        row.setUserId(user.getId()); row.setEmail(user.getEmail()); row.setTokenHash(Sha256Util.sha256Hex(token));
        row.setStatus(MembershipInvitationStatus.INVITED); row.setExpiresAt(LocalDateTime.now().plusDays(3));
        row.setInvitedBy(actorId);
        return new Created(invitationRepository.save(row), token);
    }

    @Transactional
    public Long accept(String rawToken, String password) {
        if (password == null || password.length() < 8) throw new BadRequestException("Пароль должен содержать не менее 8 символов", "PASSWORD_TOO_SHORT");
        MembershipInvitation row = invitationRepository.findByTokenHash(Sha256Util.sha256Hex(rawToken))
                .orElseThrow(() -> new NotFoundException("Приглашение не найдено", "DOCUMENT_FLOW_INVITATION_NOT_FOUND"));
        if (row.getStatus() != MembershipInvitationStatus.INVITED || row.getExpiresAt().isBefore(LocalDateTime.now())) {
            if (row.getStatus() == MembershipInvitationStatus.INVITED) row.setStatus(MembershipInvitationStatus.EXPIRED);
            throw new BadRequestException("Приглашение истекло или уже использовано", "DOCUMENT_FLOW_INVITATION_EXPIRED");
        }
        User user = userRepository.findById(row.getUserId()).orElseThrow();
        user.setPasswordHash(passwordEncoder.encode(password)); userRepository.save(user);
        DocumentFlowMembership membership = membershipRepository.findById(row.getMembershipId()).orElseThrow();
        membership.setStatus(MembershipStatus.ACTIVE); membership.setJoinedAt(LocalDateTime.now()); membershipRepository.save(membership);
        row.setStatus(MembershipInvitationStatus.ACCEPTED); row.setAcceptedAt(LocalDateTime.now()); invitationRepository.save(row);
        auditLogService.log(ENTITY_TYPE, membership.getId(), null, user, "MEMBER_INVITE_ACCEPTED",
                MembershipStatus.INVITED.name(), MembershipStatus.ACTIVE.name(), null);
        return membership.getId();
    }

    @Transactional
    public void decline(String rawToken) {
        MembershipInvitation row = invitationRepository.findByTokenHash(Sha256Util.sha256Hex(rawToken))
                .orElseThrow(() -> new NotFoundException("Приглашение не найдено", "DOCUMENT_FLOW_INVITATION_NOT_FOUND"));
        if (row.getStatus() != MembershipInvitationStatus.INVITED || row.getExpiresAt().isBefore(LocalDateTime.now())) {
            if (row.getStatus() == MembershipInvitationStatus.INVITED) row.setStatus(MembershipInvitationStatus.EXPIRED);
            throw new BadRequestException("Приглашение истекло или уже использовано", "DOCUMENT_FLOW_INVITATION_EXPIRED");
        }
        row.setStatus(MembershipInvitationStatus.DECLINED);
        invitationRepository.save(row);
        User user = userRepository.findById(row.getUserId()).orElse(null);
        auditLogService.log(ENTITY_TYPE, row.getMembershipId(), null, user, "MEMBER_INVITE_DECLINED",
                MembershipStatus.INVITED.name(), null, null);
    }
}
