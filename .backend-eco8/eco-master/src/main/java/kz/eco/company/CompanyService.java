package kz.eco.company;

import kz.eco.common.ApiFieldError;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.ValidationException;
import kz.eco.company.dto.CompanyDtos;
import kz.eco.protocol.ProtocolRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class CompanyService {

    private static final Pattern BIN_PATTERN = Pattern.compile("\\d{12}");
    private static final Pattern IBAN_PATTERN = Pattern.compile("KZ[0-9A-Za-z]{18}");
    private static final Pattern BIK_PATTERN = Pattern.compile("[0-9A-Za-z]{8}|[0-9A-Za-z]{11}");
    private static final Pattern KBE_PATTERN = Pattern.compile("\\d{2}");
    private static final Pattern DIGITS_ONLY = Pattern.compile("\\D+");

    private static final Set<Integer> ALLOWED_PAGE_SIZES = Set.of(10, 20, 50, 100);
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("name", "bin", "createdAt", "updatedAt", "status");
    private static final String DEFAULT_SORT = "createdAt,desc";
    private static final String ACTIVE = "ACTIVE";
    private static final String ARCHIVED = "ARCHIVED";
    private static final String DEFAULT_PRIMARY_OBJECT_NAME = "Основной объект";

    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository objectRepository;
    private final ProtocolRepository protocolRepository;
    private final CompanyAuditService auditService;
    private final CompanyPrimaryObjectMaterializer materializer;

    public CompanyService(CompanyRepository companyRepository,
                          CompanyObjectRepository objectRepository,
                          ProtocolRepository protocolRepository,
                          CompanyAuditService auditService,
                          CompanyPrimaryObjectMaterializer materializer) {
        this.companyRepository = companyRepository;
        this.objectRepository = objectRepository;
        this.protocolRepository = protocolRepository;
        this.auditService = auditService;
        this.materializer = materializer;
    }

    // ---------------------------------------------------------------- list / search / card

    @Transactional(readOnly = true)
    public PageResponse<CompanyDtos.CompanyListItemDto> list(String search, CompanyStatus status,
                                                              Integer page, Integer size, String sort) {
        int resolvedPage = page != null && page >= 0 ? page : 0;
        int resolvedSize = resolvePageSize(size);
        CompanyStatus effectiveStatus = resolveStatus(status);
        Pageable pageable = PageRequest.of(resolvedPage, resolvedSize, resolveSort(sort));

        String normalizedSearch = trimToNull(search);
        String searchDigits = normalizedSearch != null ? DIGITS_ONLY.matcher(normalizedSearch).replaceAll("") : null;
        if (searchDigits != null && searchDigits.isBlank()) {
            searchDigits = null;
        }

        var pageResult = companyRepository.search(effectiveStatus, normalizedSearch, searchDigits, pageable);
        List<Company> companies = pageResult.getContent();
        Map<Long, Long> activeCounts = toLongMap(objectRepository.countActiveByCompanyIdIn(idsOf(companies)));
        Map<Long, Long> totalCounts = toLongMap(objectRepository.countAllByCompanyIdIn(idsOf(companies)));

        return PageResponse.of(pageResult, c -> toListItemDto(c, totalCounts, activeCounts));
    }

    /** size=null means "no explicit request" -&gt; default 20; anything else must be one of the
     *  allowed sizes - no unlimited page size is ever accepted. */
    private int resolvePageSize(Integer size) {
        if (size == null) {
            return 20;
        }
        if (!ALLOWED_PAGE_SIZES.contains(size)) {
            throw new ValidationException("Недопустимый размер страницы",
                    List.of(new ApiFieldError("size", "INVALID_PAGE_SIZE",
                            "Разрешённые размеры страницы: " + ALLOWED_PAGE_SIZES)));
        }
        return size;
    }

    private CompanyStatus resolveStatus(CompanyStatus requested) {
        // status=ALL (no filter) is expressed as a null CompanyStatus in the query; a request
        // that omits the param entirely defaults to ACTIVE per spec.
        return requested;
    }

    private Sort resolveSort(String sortParam) {
        String effective = sortParam != null && !sortParam.isBlank() ? sortParam : DEFAULT_SORT;
        String[] parts = effective.split(",", 2);
        String field = parts[0].trim();
        if (!ALLOWED_SORT_FIELDS.contains(field)) {
            throw new ValidationException("Недопустимое поле сортировки",
                    List.of(new ApiFieldError("sort", "INVALID_SORT_FIELD",
                            "Разрешённые поля сортировки: " + ALLOWED_SORT_FIELDS)));
        }
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, field);
    }

    @Transactional(readOnly = true)
    public List<CompanyDtos.CompanySearchDto> search(String query) {
        String normalized = trimToNull(query);
        if (normalized == null) {
            return List.of();
        }
        return companyRepository.quickSearch(normalized, PageRequest.of(0, 20))
                .stream().map(this::toSearchDto).toList();
    }

    @Transactional
    public CompanyDtos.CompanyCardDto getCard(Long id, boolean includeArchivedObjects) {
        Company company = getOrThrow(id);
        ensurePrimaryObject(company);
        List<CompanyObject> objects = includeArchivedObjects
                ? objectRepository.findByCompanyIdOrderByNameAsc(id)
                : objectRepository.findByCompanyIdAndStatusOrderByNameAsc(id, ACTIVE);

        List<Long> idList = List.of(id);
        long activeCount = toLongMap(objectRepository.countActiveByCompanyIdIn(idList)).getOrDefault(id, 0L);
        long archivedCount = toLongMap(objectRepository.countArchivedByCompanyIdIn(idList)).getOrDefault(id, 0L);

        long protocolsCount = protocolRepository.countByCompanyId(id);
        String lastProtocolDate = protocolRepository.findLastProtocolDateByCompanyId(id)
                .map(java.time.LocalDate::toString).orElse(null);
        boolean archived = company.getStatus() == CompanyStatus.ARCHIVED;

        CompanyDtos.CompanyStatisticsDto statistics = new CompanyDtos.CompanyStatisticsDto(
                protocolsCount, (int) activeCount, (int) archivedCount, lastProtocolDate);
        CompanyDtos.CompanyPermissionsDto permissions = new CompanyDtos.CompanyPermissionsDto(
                !archived, !archived, !archived);

        return new CompanyDtos.CompanyCardDto(
                company.getId(), company.getName(), company.getBin(), company.getLegalAddress(),
                company.getActualAddress(), company.getPhone(), company.getEmail(), company.getComment(),
                company.getNotes(), company.getDirectorName(), company.getDirectorPosition(),
                company.getResponsiblePerson(), company.getResponsiblePersonPhone(), company.getBankName(),
                company.getIban(), company.getBik(), company.getKbe(), company.getKnp(), company.getContractNumber(),
                company.getContractDate(), company.getObjectName(), company.getObjectAddress(),
                company.getActivityType(), company.getSamplingLocation(), company.getCustomerRepresentative(),
                company.getStatus(), archived,
                objects.stream().map(this::toObjectDto).toList(),
                statistics, permissions,
                company.getCreatedAt(), company.getUpdatedAt()
        );
    }

    @Transactional(readOnly = true)
    public CompanyDtos.CompanyDto get(Long id) {
        Company company = getOrThrow(id);
        return toDto(company, objectCounts(List.of(company)));
    }

    // ---------------------------------------------------------------- create / update / archive / restore

    @Transactional
    public CompanyDtos.CompanyDto create(CompanyDtos.CreateCompanyRequest request, Long userId) {
        Company company = new Company();
        applyCreate(company, request);
        validateCompany(company, null);
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        // Composite operation, same transaction: every new company gets a real primary object
        // immediately - no lazy/virtual placeholder involved (see materializer for the
        // backward-compatibility self-healing path used by pre-existing companies instead).
        CompanyObject primary = buildPrimaryObject(company);
        objectRepository.save(primary);

        auditService.log("COMPANY", company.getId(), CompanyAuditAction.COMPANY_CREATED, userId, List.of());
        auditService.log("COMPANY_OBJECT", primary.getId(), CompanyAuditAction.OBJECT_CREATED, userId, List.of());

        return toDto(company, Map.of(company.getId(), 1));
    }

    @Transactional
    public CompanyDtos.CompanyDto update(Long id, CompanyDtos.UpdateCompanyRequest request, Long userId) {
        Company company = getOrThrow(id);
        requireNotArchived(company);
        Map<String, Object> before = snapshotForDiff(company);
        applyPatch(company, request);
        validateCompany(company, id);
        companyRepository.save(company);

        List<String> changed = diffChangedFields(before, snapshotForDiff(company));
        if (!changed.isEmpty()) {
            auditService.log("COMPANY", company.getId(), CompanyAuditAction.COMPANY_UPDATED, userId, changed);
        }
        return toDto(company, objectCounts(List.of(company)));
    }

    @Transactional
    public String delete(Long id, Long userId) {
        Company company = getOrThrow(id);
        if (protocolRepository.existsByCompanyId(id)) {
            company.setStatus(CompanyStatus.ARCHIVED);
            company.setArchivedAt(LocalDateTime.now());
            company.setArchivedBy(userId);
            companyRepository.save(company);
            return "Компания использовалась в протоколах и была архивирована";
        }
        companyRepository.delete(company);
        return "Компания удалена";
    }

    /** Variant A: archiving a company transactionally archives its active objects too, rather
     *  than leaving them reachable while the parent is archived. */
    @Transactional
    public CompanyDtos.CompanyDto archive(Long id, Long userId) {
        Company company = getOrThrow(id);
        if (company.getStatus() != CompanyStatus.ARCHIVED) {
            company.setStatus(CompanyStatus.ARCHIVED);
            company.setArchivedAt(LocalDateTime.now());
            company.setArchivedBy(userId);
            companyRepository.save(company);

            List<CompanyObject> activeObjects = objectRepository.findByCompanyIdAndStatusOrderByNameAsc(id, ACTIVE);
            for (CompanyObject object : activeObjects) {
                object.setStatus(ARCHIVED);
                object.setArchivedAt(LocalDateTime.now());
                object.setArchivedBy(userId);
                objectRepository.save(object);
                auditService.log("COMPANY_OBJECT", object.getId(), CompanyAuditAction.OBJECT_ARCHIVED, userId, List.of());
            }
            auditService.log("COMPANY", id, CompanyAuditAction.COMPANY_ARCHIVED, userId, List.of());
        }
        return toDto(company, objectCounts(List.of(company)));
    }

    /**
     * Restoring a company does NOT restore its objects - archiving them was an explicit,
     * separately-audited action, so un-archiving the company only reopens editing at the company
     * level; each object must be restored individually if it's still needed. Idempotent.
     */
    @Transactional
    public CompanyDtos.CompanyDto restore(Long id, Long userId) {
        Company company = getOrThrow(id);
        if (company.getStatus() == CompanyStatus.ARCHIVED) {
            company.setStatus(CompanyStatus.ACTIVE);
            company.setArchivedAt(null);
            company.setArchivedBy(null);
            companyRepository.save(company);
            auditService.log("COMPANY", id, CompanyAuditAction.COMPANY_RESTORED, userId, List.of());
        }
        return toDto(company, objectCounts(List.of(company)));
    }

    // ---------------------------------------------------------------- objects

    @Transactional
    public List<CompanyDtos.CompanyObjectDto> listObjects(Long companyId, boolean includeArchived) {
        Company company = getOrThrow(companyId);
        ensurePrimaryObject(company);
        List<CompanyObject> objects = includeArchived
                ? objectRepository.findByCompanyIdOrderByNameAsc(companyId)
                : objectRepository.findByCompanyIdAndStatusOrderByNameAsc(companyId, ACTIVE);
        return objects.stream().map(this::toObjectDto).toList();
    }

    @Transactional
    public CompanyDtos.CompanyObjectDto getObject(Long companyId, Long objectId) {
        getOrThrow(companyId);
        CompanyObject object = objectRepository.findByIdAndCompanyId(objectId, companyId)
                .orElseThrow(() -> new NotFoundException("Объект не найден или не принадлежит компании", "COMPANY_OBJECT_NOT_FOUND"));
        return toObjectDto(object);
    }

    @Transactional
    public CompanyDtos.CompanyObjectDto createObject(Long companyId, CompanyDtos.CompanyObjectPayload request, Long userId) {
        Company company = getOrThrow(companyId);
        requireNotArchived(company);
        CompanyObject obj = new CompanyObject();
        obj.setCompanyId(companyId);
        applyObjectPayload(obj, request);
        validateObject(obj);
        objectRepository.save(obj);
        auditService.log("COMPANY_OBJECT", obj.getId(), CompanyAuditAction.OBJECT_CREATED, userId, List.of());
        return toObjectDto(obj);
    }

    @Transactional
    public CompanyDtos.CompanyObjectDto updateObject(Long companyId, Long objectId, CompanyDtos.CompanyObjectPayload request, Long userId) {
        Company company = getOrThrow(companyId);
        requireNotArchived(company);
        CompanyObject obj = objectRepository.findByIdAndCompanyId(objectId, companyId)
                .orElseThrow(() -> new NotFoundException("Объект не найден или не принадлежит компании", "COMPANY_OBJECT_NOT_FOUND"));
        if (!ACTIVE.equalsIgnoreCase(obj.getStatus())) {
            throw new ConflictException("Архивный объект нельзя редактировать", "COMPANY_OBJECT_ARCHIVED");
        }
        applyObjectPayload(obj, request);
        validateObject(obj);
        objectRepository.save(obj);
        auditService.log("COMPANY_OBJECT", obj.getId(), CompanyAuditAction.OBJECT_UPDATED, userId, List.of());
        return toObjectDto(obj);
    }

    @Transactional
    public CompanyDtos.CompanyObjectDto archiveObject(Long companyId, Long objectId, Long userId) {
        getOrThrow(companyId);
        CompanyObject obj = objectRepository.findByIdAndCompanyId(objectId, companyId)
                .orElseThrow(() -> new NotFoundException("Объект не найден или не принадлежит компании", "COMPANY_OBJECT_NOT_FOUND"));
        // Idempotent, and archiving an object doesn't require the parent company to still be
        // editable - a company that just got archived can still have its objects archived too.
        if (!ARCHIVED.equalsIgnoreCase(obj.getStatus())) {
            obj.setStatus(ARCHIVED);
            obj.setArchivedAt(LocalDateTime.now());
            obj.setArchivedBy(userId);
            objectRepository.save(obj);
            auditService.log("COMPANY_OBJECT", obj.getId(), CompanyAuditAction.OBJECT_ARCHIVED, userId, List.of());
        }
        return toObjectDto(obj);
    }

    @Transactional
    public CompanyDtos.CompanyObjectDto restoreObject(Long companyId, Long objectId, Long userId) {
        Company company = getOrThrow(companyId);
        requireNotArchived(company);
        CompanyObject obj = objectRepository.findByIdAndCompanyId(objectId, companyId)
                .orElseThrow(() -> new NotFoundException("Объект не найден или не принадлежит компании", "COMPANY_OBJECT_NOT_FOUND"));
        if (!ACTIVE.equalsIgnoreCase(obj.getStatus())) {
            obj.setStatus(ACTIVE);
            obj.setArchivedAt(null);
            obj.setArchivedBy(null);
            objectRepository.save(obj);
            auditService.log("COMPANY_OBJECT", obj.getId(), CompanyAuditAction.OBJECT_RESTORED, userId, List.of());
        }
        return toObjectDto(obj);
    }

    // ---------------------------------------------------------------- primary-object materialization

    /**
     * Backward-compatibility safety net (spec §4): if a company is ever found with zero
     * company_objects rows - old data from before this fix, or any other bypass of create() -
     * this materializes a real primary object for it on the next read/write, transactionally.
     * Concurrent callers racing to materialize the same company's first object are resolved by
     * the unique-index-backed retry in CompanyPrimaryObjectMaterializer, not an in-JVM lock.
     */
    private void ensurePrimaryObject(Company company) {
        if (objectRepository.existsByCompanyId(company.getId())) {
            return;
        }
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                CompanyObject created = materializer.materialize(
                        company.getId(), primaryObjectName(company), primaryObjectAddress(company),
                        company.getActivityType(), company.getSamplingLocation(), company.getComment(),
                        company.getStatus() == CompanyStatus.ARCHIVED ? ARCHIVED : ACTIVE);
                auditService.log("COMPANY_OBJECT", created.getId(), CompanyAuditAction.OBJECT_CREATED, null, List.of("materialized"));
                return;
            } catch (DataIntegrityViolationException e) {
                // Another request materialized it first - if it's really there now, we're done;
                // otherwise (a real constraint issue) keep retrying up to the attempt cap.
                if (objectRepository.existsByCompanyId(company.getId())) {
                    return;
                }
            }
        }
    }

    private CompanyObject buildPrimaryObject(Company company) {
        CompanyObject obj = new CompanyObject();
        obj.setCompanyId(company.getId());
        obj.setName(primaryObjectName(company));
        obj.setAddress(primaryObjectAddress(company));
        obj.setActivityType(company.getActivityType());
        obj.setSamplingLocation(company.getSamplingLocation());
        obj.setNotes(company.getComment());
        obj.setStatus(ACTIVE);
        obj.setPrimary(true);
        return obj;
    }

    private String primaryObjectName(Company company) {
        if (company.getObjectName() != null && !company.getObjectName().isBlank()) {
            return company.getObjectName();
        }
        if (company.getName() != null && !company.getName().isBlank()) {
            return DEFAULT_PRIMARY_OBJECT_NAME + " - " + company.getName();
        }
        return DEFAULT_PRIMARY_OBJECT_NAME;
    }

    private String primaryObjectAddress(Company company) {
        return firstNonBlank(company.getObjectAddress(), company.getLegalAddress(), company.getActualAddress());
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- shared helpers

    private void requireNotArchived(Company company) {
        if (company.getStatus() == CompanyStatus.ARCHIVED) {
            throw new ConflictException("Архивную компанию нельзя редактировать", "COMPANY_ARCHIVED");
        }
    }

    private void applyObjectPayload(CompanyObject obj, CompanyDtos.CompanyObjectPayload request) {
        if (request.name() != null) obj.setName(trimToNull(request.name()));
        if (request.address() != null) obj.setAddress(trimToNull(request.address()));
        if (request.activityType() != null) obj.setActivityType(trimToNull(request.activityType()));
        if (request.samplingLocation() != null) obj.setSamplingLocation(trimToNull(request.samplingLocation()));
        if (request.coordinates() != null) obj.setCoordinates(trimToNull(request.coordinates()));
        if (request.sanitaryZone() != null) obj.setSanitaryZone(trimToNull(request.sanitaryZone()));
        if (request.notes() != null) obj.setNotes(trimToNull(request.notes()));
    }

    private void validateObject(CompanyObject obj) {
        List<ApiFieldError> errors = new ArrayList<>();
        if (obj.getName() == null || obj.getName().isBlank()) {
            errors.add(new ApiFieldError("name", "REQUIRED", "Название объекта обязательно"));
        }
        if (obj.getAddress() == null || obj.getAddress().isBlank()) {
            errors.add(new ApiFieldError("address", "REQUIRED", "Адрес объекта обязателен"));
        }
        String coordinates = obj.getCoordinates();
        if (coordinates != null && !coordinates.isBlank()) {
            String[] parts = coordinates.split(",");
            if (parts.length != 2) {
                errors.add(new ApiFieldError("coordinates", "INVALID_FORMAT",
                        "Координаты должны содержать широту и долготу через запятую"));
            } else {
                try {
                    double lat = Double.parseDouble(parts[0].trim());
                    double lon = Double.parseDouble(parts[1].trim());
                    if (lat < -90 || lat > 90) {
                        errors.add(new ApiFieldError("coordinates", "INVALID_LATITUDE", "Широта должна быть от -90 до 90"));
                    } else if (lon < -180 || lon > 180) {
                        errors.add(new ApiFieldError("coordinates", "INVALID_LONGITUDE", "Долгота должна быть от -180 до 180"));
                    }
                } catch (NumberFormatException e) {
                    errors.add(new ApiFieldError("coordinates", "INVALID_FORMAT", "Некорректный формат координат"));
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException("Некорректные данные объекта", errors);
        }
    }

    private CompanyDtos.CompanyObjectDto toObjectDto(CompanyObject obj) {
        return new CompanyDtos.CompanyObjectDto(
                obj.getId(),
                obj.getCompanyId(),
                obj.getName(),
                obj.getAddress(),
                obj.getActivityType(),
                obj.getSamplingLocation(),
                obj.getCoordinates(),
                obj.getSanitaryZone(),
                obj.getNotes(),
                ARCHIVED.equalsIgnoreCase(obj.getStatus()) ? CompanyStatus.ARCHIVED : CompanyStatus.ACTIVE,
                obj.isPrimary()
        );
    }

    private Company getOrThrow(Long id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Компания не найдена", "COMPANY_NOT_FOUND"));
    }

    private static List<Long> idsOf(List<Company> companies) {
        return companies.stream().map(Company::getId).toList();
    }

    private static Map<Long, Long> toLongMap(List<CompanyObjectRepository.CompanyObjectCount> rows) {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (CompanyObjectRepository.CompanyObjectCount row : rows) {
            map.put(row.getCompanyId(), row.getTotal());
        }
        return map;
    }

    /** Single aggregate query for the whole batch, not one COUNT per company. */
    private Map<Long, Integer> objectCounts(List<Company> companies) {
        List<Long> ids = idsOf(companies);
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Integer> counts = new LinkedHashMap<>();
        for (CompanyObjectRepository.CompanyObjectCount row : objectRepository.countActiveByCompanyIdIn(ids)) {
            counts.put(row.getCompanyId(), row.getTotal().intValue());
        }
        for (Company company : companies) {
            counts.putIfAbsent(company.getId(), 0);
        }
        return counts;
    }

    private void applyCreate(Company company, CompanyDtos.CreateCompanyRequest request) {
        company.setName(trimToNull(request.name()));
        company.setBin(normalizeBin(request.bin()));
        company.setLegalAddress(trimToNull(request.legalAddress()));
        company.setActualAddress(trimToNull(request.actualAddress()));
        company.setPhone(normalizePhone(request.phone()));
        company.setEmail(trimToNull(request.email()));
        company.setComment(trimToNull(request.comment()));
        company.setNotes(trimToNull(request.notes()));
        company.setDirectorName(trimToNull(request.directorName()));
        company.setDirectorPosition(trimToNull(request.directorPosition()));
        company.setResponsiblePerson(trimToNull(request.responsiblePerson()));
        company.setResponsiblePersonPhone(normalizePhone(request.responsiblePersonPhone()));
        company.setBankName(trimToNull(request.bankName()));
        company.setIban(trimToNull(request.iban()));
        company.setBik(trimToNull(request.bik()));
        company.setKbe(trimToNull(request.kbe()));
        company.setKnp(trimToNull(request.knp()));
        company.setContractNumber(trimToNull(request.contractNumber()));
        company.setContractDate(request.contractDate());
        company.setObjectName(trimToNull(request.objectName()));
        company.setObjectAddress(trimToNull(request.objectAddress()));
        company.setActivityType(trimToNull(request.activityType()));
        company.setSamplingLocation(trimToNull(request.samplingLocation()));
        company.setCustomerRepresentative(trimToNull(request.customerRepresentative()));
    }

    private void applyPatch(Company company, CompanyDtos.UpdateCompanyRequest request) {
        if (request.name() != null) company.setName(trimToNull(request.name()));
        if (request.bin() != null) company.setBin(normalizeBin(request.bin()));
        if (request.legalAddress() != null) company.setLegalAddress(trimToNull(request.legalAddress()));
        if (request.actualAddress() != null) company.setActualAddress(trimToNull(request.actualAddress()));
        if (request.phone() != null) company.setPhone(normalizePhone(request.phone()));
        if (request.email() != null) company.setEmail(trimToNull(request.email()));
        if (request.comment() != null) company.setComment(trimToNull(request.comment()));
        if (request.notes() != null) company.setNotes(trimToNull(request.notes()));
        if (request.directorName() != null) company.setDirectorName(trimToNull(request.directorName()));
        if (request.directorPosition() != null) company.setDirectorPosition(trimToNull(request.directorPosition()));
        if (request.responsiblePerson() != null) company.setResponsiblePerson(trimToNull(request.responsiblePerson()));
        if (request.responsiblePersonPhone() != null) company.setResponsiblePersonPhone(normalizePhone(request.responsiblePersonPhone()));
        if (request.bankName() != null) company.setBankName(trimToNull(request.bankName()));
        if (request.iban() != null) company.setIban(trimToNull(request.iban()));
        if (request.bik() != null) company.setBik(trimToNull(request.bik()));
        if (request.kbe() != null) company.setKbe(trimToNull(request.kbe()));
        if (request.knp() != null) company.setKnp(trimToNull(request.knp()));
        if (request.contractNumber() != null) company.setContractNumber(trimToNull(request.contractNumber()));
        if (request.contractDate() != null) company.setContractDate(request.contractDate());
        if (request.objectName() != null) company.setObjectName(trimToNull(request.objectName()));
        if (request.objectAddress() != null) company.setObjectAddress(trimToNull(request.objectAddress()));
        if (request.activityType() != null) company.setActivityType(trimToNull(request.activityType()));
        if (request.samplingLocation() != null) company.setSamplingLocation(trimToNull(request.samplingLocation()));
        if (request.customerRepresentative() != null) company.setCustomerRepresentative(trimToNull(request.customerRepresentative()));
    }

    private void validateCompany(Company company, Long excludeId) {
        List<ApiFieldError> errors = new ArrayList<>();
        if (company.getName() == null) {
            errors.add(new ApiFieldError("name", "REQUIRED", "Название компании обязательно"));
        }
        if (company.getBin() == null) {
            errors.add(new ApiFieldError("bin", "REQUIRED", "БИН / ИИН обязателен"));
        } else if (!BIN_PATTERN.matcher(company.getBin()).matches()) {
            errors.add(new ApiFieldError("bin", "INVALID_FORMAT", "БИН должен содержать ровно 12 цифр"));
        } else {
            boolean duplicate = excludeId != null
                    ? companyRepository.existsByBinAndIdNot(company.getBin(), excludeId)
                    : companyRepository.existsByBin(company.getBin());
            if (duplicate) {
                throw new ConflictException("Компания с таким БИН уже существует",
                        List.of(new ApiFieldError("bin", "DUPLICATE_BIN", "Компания с таким БИН уже существует")));
            }
        }
        if (company.getLegalAddress() == null && company.getActualAddress() == null) {
            errors.add(new ApiFieldError("legalAddress", "REQUIRED", "Укажите юридический или фактический адрес"));
        }
        if (company.getPhone() == null && company.getEmail() == null) {
            errors.add(new ApiFieldError("phone", "REQUIRED", "Укажите телефон или email"));
        }
        if (company.getPhone() != null && digitCount(company.getPhone()) < 10) {
            errors.add(new ApiFieldError("phone", "INVALID_FORMAT", "Телефон должен содержать минимум 10 цифр"));
        }
        if (company.getIban() != null && !IBAN_PATTERN.matcher(company.getIban()).matches()) {
            errors.add(new ApiFieldError("iban", "INVALID_FORMAT", "IBAN должен начинаться с KZ и содержать 20 символов"));
        }
        if (company.getBik() != null && !BIK_PATTERN.matcher(company.getBik()).matches()) {
            errors.add(new ApiFieldError("bik", "INVALID_FORMAT", "БИК должен содержать 8 или 11 символов"));
        }
        if (company.getKbe() != null && !KBE_PATTERN.matcher(company.getKbe()).matches()) {
            errors.add(new ApiFieldError("kbe", "INVALID_FORMAT", "КБЕ должен содержать ровно 2 цифры"));
        }
        if (!errors.isEmpty()) {
            throw new ValidationException("Некорректные данные компании", errors);
        }
    }

    /** BIN is stored digits-only (12 digits, enforced by validateCompany) - stripping separators
     *  here means "123 456 789 012" and "123456789012" are treated as the same value. */
    private static String normalizeBin(String raw) {
        String trimmed = trimToNull(raw);
        return trimmed != null ? DIGITS_ONLY.matcher(trimmed).replaceAll("") : null;
    }

    /** Normalizes to a leading "+" (if the original had a country-code prefix) followed by digits
     *  only, so "+7 (700) 000-00-00" and "+77000000000" store identically. */
    private static String normalizePhone(String raw) {
        String trimmed = trimToNull(raw);
        if (trimmed == null) {
            return null;
        }
        String digits = DIGITS_ONLY.matcher(trimmed).replaceAll("");
        return trimmed.startsWith("+") ? "+" + digits : digits;
    }

    private static int digitCount(String value) {
        int count = 0;
        for (char c : value.toCharArray()) {
            if (Character.isDigit(c)) {
                count++;
            }
        }
        return count;
    }

    private static final List<String> DIFF_FIELDS = List.of(
            "name", "bin", "legalAddress", "actualAddress", "phone", "email", "comment", "notes",
            "directorName", "directorPosition", "responsiblePerson", "responsiblePersonPhone",
            "bankName", "iban", "bik", "kbe", "knp", "contractNumber", "contractDate",
            "objectName", "objectAddress", "activityType", "samplingLocation", "customerRepresentative");

    /** Field-name-only snapshot for the audit diff - never captures values, so nothing sensitive
     *  ends up compared/logged beyond "this field changed". */
    private Map<String, Object> snapshotForDiff(Company company) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", company.getName());
        snapshot.put("bin", company.getBin());
        snapshot.put("legalAddress", company.getLegalAddress());
        snapshot.put("actualAddress", company.getActualAddress());
        snapshot.put("phone", company.getPhone());
        snapshot.put("email", company.getEmail());
        snapshot.put("comment", company.getComment());
        snapshot.put("notes", company.getNotes());
        snapshot.put("directorName", company.getDirectorName());
        snapshot.put("directorPosition", company.getDirectorPosition());
        snapshot.put("responsiblePerson", company.getResponsiblePerson());
        snapshot.put("responsiblePersonPhone", company.getResponsiblePersonPhone());
        snapshot.put("bankName", company.getBankName());
        snapshot.put("iban", company.getIban());
        snapshot.put("bik", company.getBik());
        snapshot.put("kbe", company.getKbe());
        snapshot.put("knp", company.getKnp());
        snapshot.put("contractNumber", company.getContractNumber());
        snapshot.put("contractDate", company.getContractDate());
        snapshot.put("objectName", company.getObjectName());
        snapshot.put("objectAddress", company.getObjectAddress());
        snapshot.put("activityType", company.getActivityType());
        snapshot.put("samplingLocation", company.getSamplingLocation());
        snapshot.put("customerRepresentative", company.getCustomerRepresentative());
        return snapshot;
    }

    private List<String> diffChangedFields(Map<String, Object> before, Map<String, Object> after) {
        List<String> changed = new ArrayList<>();
        for (String field : DIFF_FIELDS) {
            if (!Objects.equals(before.get(field), after.get(field))) {
                changed.add(field);
            }
        }
        return changed;
    }

    private CompanyDtos.CompanyListItemDto toListItemDto(Company company, Map<Long, Long> totalCounts, Map<Long, Long> activeCounts) {
        return new CompanyDtos.CompanyListItemDto(
                company.getId(),
                company.getName(),
                company.getBin(),
                company.getPhone(),
                company.getEmail(),
                firstNonBlank(company.getLegalAddress(), company.getActualAddress()),
                company.getStatus() == CompanyStatus.ARCHIVED,
                totalCounts.getOrDefault(company.getId(), 0L).intValue(),
                activeCounts.getOrDefault(company.getId(), 0L).intValue(),
                company.getCreatedAt(),
                company.getUpdatedAt()
        );
    }

    private CompanyDtos.CompanyDto toDto(Company company, Map<Long, Integer> objectCounts) {
        int count = objectCounts.getOrDefault(company.getId(), 0);
        return new CompanyDtos.CompanyDto(
                company.getId(), company.getName(), company.getBin(), company.getLegalAddress(),
                company.getActualAddress(), company.getPhone(), company.getEmail(), company.getComment(),
                company.getNotes(), company.getDirectorName(), company.getDirectorPosition(),
                company.getResponsiblePerson(), company.getResponsiblePersonPhone(), company.getBankName(),
                company.getIban(), company.getBik(), company.getKbe(), company.getKnp(), company.getContractNumber(),
                company.getContractDate(), company.getObjectName(), company.getObjectAddress(),
                company.getActivityType(), company.getSamplingLocation(), company.getCustomerRepresentative(),
                company.getStatus(), count, company.getCreatedAt(), company.getUpdatedAt()
        );
    }

    private CompanyDtos.CompanySearchDto toSearchDto(Company company) {
        return new CompanyDtos.CompanySearchDto(
                company.getId(), company.getName(), company.getBin(), company.getLegalAddress(),
                company.getActualAddress(), company.getPhone(), company.getEmail(), company.getObjectName(), company.getStatus()
        );
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
