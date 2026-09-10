package kz.eco.pek;

import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/** Read-only CRM-backed selector for PEK. It deliberately does not reuse /api/companies and
 * never treats a client-supplied company id as proof of access. */
@Service
public class PekScopeService {
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository objectRepository;
    private final PekAccessService accessService;

    public PekScopeService(CompanyRepository companyRepository, CompanyObjectRepository objectRepository,
                           PekAccessService accessService) {
        this.companyRepository = companyRepository;
        this.objectRepository = objectRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ScopeCompanyResponse> companies(User user) {
        Set<Long> ids = accessService.hasGlobalAccess(user.getRole())
                ? null : accessService.resolveAccessibleCompanyIds(user.getId(), user.getRole());
        return companyRepository.findActiveForPekScope(ids).stream()
                .map(c -> new PekApiDtos.ScopeCompanyResponse(c.getId(), c.getName(), c.getBin()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PekApiDtos.ScopeCompanyObjectResponse> objects(User user, Long companyId) {
        // Access is checked before returning either existence or objects, avoiding a cross-tenant
        // company-id enumeration oracle for non-global users.
        accessService.requireCompanyAccess(user.getId(), user.getRole(), companyId);
        var company = companyRepository.findById(companyId)
                .orElseThrow(() -> new NotFoundException("Компания не найдена: " + companyId));
        if (company.getStatus() != CompanyStatus.ACTIVE || company.getArchivedAt() != null) {
            throw new NotFoundException("Активная компания не найдена: " + companyId);
        }
        return objectRepository.findActiveRealByCompanyId(companyId).stream()
                .map(o -> new PekApiDtos.ScopeCompanyObjectResponse(o.getId(), o.getCompanyId(),
                        o.getName(), o.getAddress(), o.getStatus()))
                .toList();
    }
}
