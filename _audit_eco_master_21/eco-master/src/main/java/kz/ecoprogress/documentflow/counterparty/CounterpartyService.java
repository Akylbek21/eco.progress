package kz.ecoprogress.documentflow.counterparty;

import kz.eco.common.ApiFieldError;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Every entry point here MUST route through {@link DocumentFlowAccessService} before touching
 * data - counterparties were previously reachable by a suspended/expired/read-only organization
 * because this service predated the centralized access gate (see the module's access-service
 * javadoc for the caller contract). Do not add a new method that skips requireActiveAccess/
 * requireWriteAccess.
 */
@Service
public class CounterpartyService {

    private final CounterpartyRepository counterpartyRepository;
    private final CounterpartyRepresentativeRepository representativeRepository;
    private final DocumentFlowAccessService accessService;

    public CounterpartyService(CounterpartyRepository counterpartyRepository,
                                CounterpartyRepresentativeRepository representativeRepository,
                                DocumentFlowAccessService accessService) {
        this.counterpartyRepository = counterpartyRepository;
        this.representativeRepository = representativeRepository;
        this.accessService = accessService;
    }

    @Transactional
    public Counterparty create(Long userId, Long ownerOrganizationId, String bin, String name, Long linkedOrganizationId,
                                String directorName, String address, String email, String phone) {
        accessService.requireWriteAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        if (!accessService.hasPermission(userId, ownerOrganizationId, DocumentFlowPermission.MANAGE_COUNTERPARTIES)) {
            throw new ForbiddenException("Недостаточно прав для управления контрагентами", "COUNTERPARTY_MANAGE_FORBIDDEN");
        }
        String normalizedBin = Counterparty.normalizeBin(bin);
        counterpartyRepository.findByOwnerOrganizationIdAndNormalizedBin(ownerOrganizationId, normalizedBin)
                .ifPresent(existing -> {
                    throw new ConflictException("Контрагент с таким БИН/ИИН уже добавлен",
                            List.of(new ApiFieldError("bin", "COUNTERPARTY_DUPLICATE_BIN",
                                    "Контрагент с таким БИН/ИИН уже добавлен")));
                });

        Counterparty counterparty = new Counterparty();
        counterparty.setOwnerOrganizationId(ownerOrganizationId);
        counterparty.setLinkedOrganizationId(linkedOrganizationId);
        counterparty.setBin(bin);
        counterparty.setName(name);
        counterparty.setDirectorName(directorName);
        counterparty.setAddress(address);
        counterparty.setEmail(email);
        counterparty.setPhone(phone);
        // A concurrent request slipping past the check above still can't create a duplicate row -
        // the DB-level unique constraint on (owner_organization_id, normalized_bin) is the real
        // guarantee; this pre-check just gives a friendlier structured error in the common case.
        return counterpartyRepository.save(counterparty);
    }

    /** Internal lookup - no access check. Only call after the caller has already verified access. */
    private Counterparty getInternal(Long ownerOrganizationId, Long id) {
        return counterpartyRepository.findByIdAndOwnerOrganizationId(id, ownerOrganizationId)
                .orElseThrow(() -> new NotFoundException("Контрагент не найден", "COUNTERPARTY_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public Counterparty get(Long userId, Long ownerOrganizationId, Long id) {
        accessService.requireActiveAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        return getInternal(ownerOrganizationId, id);
    }

    @Transactional(readOnly = true)
    public PageResponse<Counterparty> list(Long userId, Long ownerOrganizationId, Pageable pageable) {
        accessService.requireActiveAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        Page<Counterparty> page = counterpartyRepository.findByOwnerOrganizationId(ownerOrganizationId, pageable);
        return PageResponse.of(page);
    }

    private static final int MAX_SEARCH_SIZE = 100;

    /** Module spec §15: server-side search by name/BIN, tenant-isolated, capped page size.
     *  {@code query} is normalized once here (lowercased/trimmed/whitespace-collapsed for the
     *  name match, digit-stripped via Counterparty.normalizeBin for the BIN match) rather than
     *  trusting the caller to pre-normalize it. */
    @Transactional(readOnly = true)
    public PageResponse<Counterparty> search(Long userId, Long ownerOrganizationId, String query,
                                              CounterpartyStatus status, Pageable pageable) {
        accessService.requireActiveAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        Pageable cappedPageable = pageable.getPageSize() > MAX_SEARCH_SIZE
                ? org.springframework.data.domain.PageRequest.of(pageable.getPageNumber(), MAX_SEARCH_SIZE, pageable.getSort())
                : pageable;
        String nameQuery = query == null ? null : query.trim().toLowerCase(java.util.Locale.ROOT).replaceAll("\\s+", " ");
        String binQuery = query == null ? null : Counterparty.normalizeBin(query);
        Page<Counterparty> page = counterpartyRepository.search(ownerOrganizationId, nameQuery, binQuery, status, cappedPageable);
        return PageResponse.of(page);
    }

    @Transactional
    public Counterparty archive(Long userId, Long ownerOrganizationId, Long id) {
        accessService.requireWriteAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        if (!accessService.hasPermission(userId, ownerOrganizationId, DocumentFlowPermission.MANAGE_COUNTERPARTIES)) {
            throw new ForbiddenException("Недостаточно прав для управления контрагентами", "COUNTERPARTY_MANAGE_FORBIDDEN");
        }
        Counterparty counterparty = getInternal(ownerOrganizationId, id);
        counterparty.setStatus(CounterpartyStatus.ARCHIVED);
        return counterpartyRepository.save(counterparty);
    }

    @Transactional
    public Counterparty update(Long userId, Long ownerOrganizationId, Long id,
                               CounterpartyController.UpdateCounterpartyRequest request) {
        accessService.requireWriteAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        if (!accessService.hasPermission(userId, ownerOrganizationId, DocumentFlowPermission.MANAGE_COUNTERPARTIES)) {
            throw new ForbiddenException("Недостаточно прав для управления контрагентами", "COUNTERPARTY_MANAGE_FORBIDDEN");
        }
        Counterparty entity = getInternal(ownerOrganizationId, id);
        if (request.expectedVersion() == null || request.expectedVersion() != entity.getVersion()) {
            throw new ConflictException("Контрагент был изменён другим пользователем", "DOCUMENT_VERSION_CONFLICT");
        }
        if (request.bin() != null && !Counterparty.normalizeBin(request.bin()).equals(entity.getNormalizedBin())) {
            counterpartyRepository.findByOwnerOrganizationIdAndNormalizedBin(ownerOrganizationId,
                            Counterparty.normalizeBin(request.bin()))
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(other -> { throw new ConflictException("Контрагент с таким БИН уже существует",
                            List.of(new ApiFieldError("bin", "COUNTERPARTY_DUPLICATE_BIN", "БИН уже используется"))); });
            entity.setBin(request.bin());
        }
        if (request.name() != null) entity.setName(request.name());
        if (request.email() != null) entity.setEmail(request.email());
        if (request.phone() != null) entity.setPhone(request.phone());
        if (request.address() != null) entity.setAddress(request.address());
        entity.setUpdatedAt(java.time.LocalDateTime.now());
        return counterpartyRepository.saveAndFlush(entity);
    }

    @Transactional
    public CounterpartyRepresentative addRepresentative(Long userId, Long ownerOrganizationId, Long counterpartyId,
                                                          String fullName, String position, String email, String phone) {
        accessService.requireWriteAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        if (!accessService.hasPermission(userId, ownerOrganizationId, DocumentFlowPermission.MANAGE_COUNTERPARTIES)) {
            throw new ForbiddenException("Недостаточно прав для управления контрагентами", "COUNTERPARTY_MANAGE_FORBIDDEN");
        }
        getInternal(ownerOrganizationId, counterpartyId); // ensures ownership + existence
        CounterpartyRepresentative representative = new CounterpartyRepresentative();
        representative.setCounterpartyId(counterpartyId);
        representative.setFullName(fullName);
        representative.setPosition(position);
        representative.setEmail(email);
        representative.setPhone(phone);
        return representativeRepository.save(representative);
    }

    @Transactional(readOnly = true)
    public List<CounterpartyRepresentative> representatives(Long userId, Long ownerOrganizationId, Long counterpartyId) {
        accessService.requireActiveAccess(userId, ownerOrganizationId);
        accessService.requireFeature(ownerOrganizationId, FeatureCode.DOCUMENT_FLOW);
        getInternal(ownerOrganizationId, counterpartyId);
        return representativeRepository.findByCounterpartyId(counterpartyId);
    }
}
