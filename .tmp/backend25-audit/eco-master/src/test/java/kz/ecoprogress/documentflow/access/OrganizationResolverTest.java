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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pure-Mockito coverage (no Spring context) of internal-mode auto-provisioning (module spec §2/§3):
 * a system ADMIN with zero document-flow memberships gets an OWNER membership of the default
 * organization created on first call; nobody else does, and the pre-existing "reject if the user
 * belongs to several organizations and didn't say which" / "reject an organizationId the user
 * doesn't actually belong to" guards are unchanged.
 */
@ExtendWith(MockitoExtension.class)
class OrganizationResolverTest {

    private static final Long USER_ID = 1L;
    private static final Long ORG_ID = 100L;

    @Mock private DocumentFlowMembershipRepository membershipRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private UserRepository userRepository;

    private DocumentFlowInternalModeProperties internalModeProperties;
    private OrganizationResolver resolver;

    @BeforeEach
    void setUp() {
        internalModeProperties = new DocumentFlowInternalModeProperties();
        resolver = new OrganizationResolver(membershipRepository, internalModeProperties, companyRepository, userRepository);
    }

    private User userWithRole(UserRole role) {
        User user = new User();
        user.setId(USER_ID);
        user.setRole(role);
        return user;
    }

    @Test
    void singleExistingMembership_resolvesWithoutTouchingInternalMode() {
        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(ORG_ID);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of(membership));

        assertEquals(ORG_ID, resolver.resolve(USER_ID, null));
        verify(userRepository, never()).findById(any());
    }

    @Test
    void noMembership_internalModeOff_throwsMembershipRequired() {
        internalModeProperties.setInternalMode(false);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of());

        assertThrows(DocumentFlowMembershipRequiredException.class, () -> resolver.resolve(USER_ID, null));
    }

    @Test
    void noMembership_internalModeOn_adminUser_autoProvisionsOwnerMembership() {
        internalModeProperties.setInternalMode(true);
        internalModeProperties.setDefaultOrganizationId(ORG_ID);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithRole(UserRole.ADMIN)));
        when(membershipRepository.findByOrganizationIdAndUserId(ORG_ID, USER_ID)).thenReturn(Optional.empty());
        when(membershipRepository.save(any(DocumentFlowMembership.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Long resolved = resolver.resolve(USER_ID, null);

        assertEquals(ORG_ID, resolved);
        ArgumentCaptor<DocumentFlowMembership> captor = ArgumentCaptor.forClass(DocumentFlowMembership.class);
        verify(membershipRepository).save(captor.capture());
        assertEquals(MembershipRole.OWNER, captor.getValue().getRoleCode());
        assertEquals(MembershipStatus.ACTIVE, captor.getValue().getStatus());
        assertEquals(ORG_ID, captor.getValue().getOrganizationId());
        assertEquals(USER_ID, captor.getValue().getUserId());
    }

    @Test
    void noMembership_internalModeOn_nonAdminUser_stillThrowsMembershipRequired() {
        internalModeProperties.setInternalMode(true);
        internalModeProperties.setDefaultOrganizationId(ORG_ID);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithRole(UserRole.MANAGER)));

        assertThrows(DocumentFlowMembershipRequiredException.class, () -> resolver.resolve(USER_ID, null));
        verify(membershipRepository, never()).save(any());
    }

    @Test
    void noMembership_internalModeOn_defaultOrgUnresolvable_throwsMembershipRequired() {
        internalModeProperties.setInternalMode(true);
        // No explicit id configured, and no company named 'EcoProgress' found either.
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of());
        lenient().when(userRepository.findById(USER_ID)).thenReturn(Optional.of(userWithRole(UserRole.ADMIN)));
        when(companyRepository.findByName(DocumentFlowInternalModeProperties.DEFAULT_ORGANIZATION_NAME))
                .thenReturn(Optional.empty());

        assertThrows(DocumentFlowMembershipRequiredException.class, () -> resolver.resolve(USER_ID, null));
    }

    @Test
    void defaultOrganizationId_explicitConfigTakesPrecedenceOverNameLookup() {
        internalModeProperties.setDefaultOrganizationId(ORG_ID);
        assertEquals(ORG_ID, resolver.resolveDefaultOrganizationId());
        verify(companyRepository, never()).findByName(any());
    }

    @Test
    void defaultOrganizationId_fallsBackToNameLookupWhenUnconfigured() {
        Company company = new Company();
        company.setId(ORG_ID);
        when(companyRepository.findByName(DocumentFlowInternalModeProperties.DEFAULT_ORGANIZATION_NAME))
                .thenReturn(Optional.of(company));

        assertEquals(ORG_ID, resolver.resolveDefaultOrganizationId());
    }

    @Test
    void multipleMemberships_noExplicitOrgId_requiresDisambiguation() {
        DocumentFlowMembership first = new DocumentFlowMembership();
        first.setOrganizationId(ORG_ID);
        DocumentFlowMembership second = new DocumentFlowMembership();
        second.setOrganizationId(200L);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of(first, second));

        assertThrows(BadRequestException.class, () -> resolver.resolve(USER_ID, null));
    }

    @Test
    void explicitOrgId_notAMembership_isRejected() {
        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(ORG_ID);
        when(membershipRepository.findByUserIdAndStatusNot(USER_ID, MembershipStatus.REMOVED))
                .thenReturn(List.of(membership));

        assertThrows(BadRequestException.class, () -> resolver.resolve(USER_ID, 999L));
    }
}
