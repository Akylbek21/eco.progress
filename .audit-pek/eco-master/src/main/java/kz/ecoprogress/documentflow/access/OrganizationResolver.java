package kz.ecoprogress.documentflow.access;

import kz.eco.common.exception.BadRequestException;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Resolves "which organization did this user mean" from their real, active memberships - used by
 * DocumentController/CounterpartyController so a request body's optional organizationId is NEVER
 * trusted blindly: it only disambiguates which of the caller's own memberships they mean,
 * validated against DocumentFlowMembershipRepository, never accepted on faith.
 *
 * <p>When {@code document-flow.internal-mode=true} (module spec: "администратор EcoProgress
 * должен уметь работать без ручных настроек"), a system {@link UserRole#ADMIN} with zero
 * memberships is auto-provisioned an ACTIVE {@link MembershipRole#OWNER} membership of the default
 * organization the first time they call any document-flow endpoint - this is the one and only
 * place that happens, so every other service in the module keeps trusting "a membership row exists
 * -> the user was genuinely granted access" without needing its own special case. A non-admin user
 * with zero memberships still gets {@link DocumentFlowMembershipRequiredException} (403) exactly as
 * before; internal mode only ever widens access for the system administrator, never for anyone
 * else, and never bypasses the membership check itself.
 */
@Component
public class OrganizationResolver {

    private final DocumentFlowMembershipRepository membershipRepository;
    private final DocumentFlowInternalModeProperties internalModeProperties;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;

    public OrganizationResolver(DocumentFlowMembershipRepository membershipRepository,
                                 DocumentFlowInternalModeProperties internalModeProperties,
                                 CompanyRepository companyRepository,
                                 UserRepository userRepository) {
        this.membershipRepository = membershipRepository;
        this.internalModeProperties = internalModeProperties;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
    }

    /** @param requestedOrganizationId optional, client-supplied hint - only used to pick among the
     *  user's own real memberships, never accepted on faith. */
    @Transactional
    public Long resolve(Long userId, Long requestedOrganizationId) {
        List<DocumentFlowMembership> memberships =
                membershipRepository.findByUserIdAndStatusNot(userId, MembershipStatus.REMOVED);

        if (memberships.isEmpty() && internalModeProperties.isInternalMode()) {
            Optional<DocumentFlowMembership> provisioned = tryAutoProvisionAdmin(userId);
            if (provisioned.isPresent()) {
                memberships = List.of(provisioned.get());
            }
        }

        if (memberships.isEmpty()) {
            throw new DocumentFlowMembershipRequiredException(
                    "Пользователь не состоит ни в одной организации модуля документооборота");
        }
        if (requestedOrganizationId != null) {
            boolean belongs = memberships.stream()
                    .anyMatch(m -> m.getOrganizationId().equals(requestedOrganizationId));
            if (!belongs) {
                throw new BadRequestException("Пользователь не состоит в указанной организации");
            }
            return requestedOrganizationId;
        }
        if (memberships.size() > 1) {
            throw new BadRequestException(
                    "Пользователь состоит в нескольких организациях - укажите organizationId явно");
        }
        return memberships.get(0).getOrganizationId();
    }

    /** Only ever provisions the system ADMIN role, and only into the configured default
     *  organization - never a stand-in for genuine invitation-based membership for anyone else. */
    private Optional<DocumentFlowMembership> tryAutoProvisionAdmin(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getRole() != UserRole.ADMIN) {
            return Optional.empty();
        }
        Long organizationId = resolveDefaultOrganizationId();
        if (organizationId == null) {
            return Optional.empty();
        }
        return Optional.of(membershipRepository.findByOrganizationIdAndUserId(organizationId, userId)
                .map(existing -> {
                    if (existing.getStatus() != MembershipStatus.ACTIVE) {
                        existing.setStatus(MembershipStatus.ACTIVE);
                        existing.setJoinedAt(LocalDateTime.now());
                        membershipRepository.save(existing);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    DocumentFlowMembership membership = new DocumentFlowMembership();
                    membership.setOrganizationId(organizationId);
                    membership.setUserId(userId);
                    membership.setRoleCode(MembershipRole.OWNER);
                    membership.setStatus(MembershipStatus.ACTIVE);
                    membership.setJoinedAt(LocalDateTime.now());
                    return membershipRepository.save(membership);
                }));
    }

    /** Explicit env var wins (required in production, per the module spec: "не использовать
     *  hardcoded ID внутри Java-классов"); falls back to looking the bootstrap company up by name
     *  for local/dev/test, where V58__document_flow_internal_mode_bootstrap.sql already created it. */
    Long resolveDefaultOrganizationId() {
        if (internalModeProperties.getDefaultOrganizationId() != null) {
            return internalModeProperties.getDefaultOrganizationId();
        }
        return companyRepository.findByName(DocumentFlowInternalModeProperties.DEFAULT_ORGANIZATION_NAME)
                .map(Company::getId)
                .orElse(null);
    }
}
