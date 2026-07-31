package kz.ecoprogress.documentflow.api;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.api.dto.AccessRequestCreateRequest;
import kz.ecoprogress.documentflow.api.dto.AccessRequestDto;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * POST /api/document-flow/access-requests - authenticated (not public) precisely because it needs
 * to know which real user/org is asking.
 *
 * Organization resolution (documented deviation - this codebase has no pre-existing "current
 * user's own company" convention to reuse: kz.eco.user.User has no FK to kz.eco.company.Company at
 * all, and every other module resolves companyId from an explicit path/body parameter supplied by
 * *staff* acting on an arbitrary client company - grepped CompanyController/CompanyService and
 * confirmed there is no "self" lookup anywhere in this codebase to fall back on):
 *  1. If the user already has exactly one non-REMOVED document_flow_memberships row, use that
 *     organization (a returning user asking about e.g. a plan change).
 *  2. Otherwise (no membership yet - the common case, since this endpoint IS how a brand-new
 *     customer first touches the module - or ambiguously several memberships), resolve/create a
 *     kz.eco.company.Company from the user's own profile fields (bin/companyName/email/phone) and
 *     create an OWNER/INVITED membership pointing at it, exactly as the ticket's "take
 *     organizationId from an authenticated user's associated Company row directly" instructs.
 */
@RestController
@RequestMapping("/api/document-flow/access-requests")
public class AccessRequestController {

    private final DocumentFlowAccessRequestRepository repository;
    private final DocumentFlowMembershipRepository membershipRepository;
    private final CompanyRepository companyRepository;

    public AccessRequestController(DocumentFlowAccessRequestRepository repository,
                                    DocumentFlowMembershipRepository membershipRepository,
                                    CompanyRepository companyRepository) {
        this.repository = repository;
        this.membershipRepository = membershipRepository;
        this.companyRepository = companyRepository;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<AccessRequestDto>> create(@Valid @RequestBody AccessRequestCreateRequest request) {
        User user = CurrentUser.get();
        Long organizationId = resolveOrganization(user);

        DocumentFlowAccessRequest entity = new DocumentFlowAccessRequest();
        entity.setOrganizationId(organizationId);
        entity.setContactName(request.contactName());
        entity.setPhone(request.phone());
        entity.setEmail(request.email());
        entity.setPlanCode(request.planCode());
        entity.setMembersCount(request.membersCount());
        entity.setComment(request.comment());
        entity.setStatus(AccessRequestStatus.NEW);
        repository.save(entity);

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(AccessRequestDto.from(entity), "Заявка отправлена"));
    }

    private Long resolveOrganization(User user) {
        List<DocumentFlowMembership> memberships = membershipRepository.findByUserIdAndStatusNot(user.getId(), MembershipStatus.REMOVED);
        if (memberships.size() == 1) {
            return memberships.get(0).getOrganizationId();
        }
        Company company = resolveOrCreateCompany(user);
        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(company.getId());
        membership.setUserId(user.getId());
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.INVITED);
        membership.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membership);
        return company.getId();
    }

    private Company resolveOrCreateCompany(User user) {
        if (user.getBin() != null && !user.getBin().isBlank()) {
            var existing = companyRepository.findByBin(user.getBin());
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        Company company = new Company();
        company.setName(user.getCompanyName() != null && !user.getCompanyName().isBlank() ? user.getCompanyName() : user.getName());
        // companies.bin has a unique index (ux_companies_bin, V24) - a user with no real BIN yet
        // gets a synthetic placeholder unique per user rather than colliding on a shared blank value.
        company.setBin(user.getBin() != null && !user.getBin().isBlank() ? user.getBin() : "DF-USER-" + user.getId());
        company.setEmail(user.getEmail());
        company.setPhone(user.getPhone());
        company.setLegalAddress(user.getLegalAddress());
        company.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(company);
    }
}
