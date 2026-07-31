package kz.eco.protocol;

import kz.eco.common.ApiFieldError;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.ValidationException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.laboratory.LaboratoryService;
import kz.eco.normative.NormativeSnapshotHelper;
import kz.eco.order.Order;
import kz.eco.order.OrderRepository;
import kz.eco.order.OrderService;
import kz.eco.order.OrderStatus;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.protocol.idempotency.ProtocolIdempotencyService;
import kz.eco.protocol.validation.MeasurementInput;
import kz.eco.protocol.validation.ProtocolValidationContext;
import kz.eco.protocol.validation.ProtocolValidationError;
import kz.eco.protocol.validation.ProtocolValidationPolicy;
import kz.eco.protocol.validation.ProtocolValidationPolicyRegistry;
import kz.eco.signature.CmsSignatureValidator;
import kz.eco.signature.SignatureInfo;
import kz.eco.signature.SignatureVerificationService;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ProtocolService {

    private static final Logger log = LoggerFactory.getLogger(ProtocolService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ProtocolRepository protocolRepository;
    private final ProtocolTemplateRepository templateRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final LaboratoryService laboratoryService;
    private final ProtocolResultRepository resultRepository;
    private final MeasurementDeviceRepository deviceRepository;
    private final ProtocolEnvironmentConditionsRepository envConditionsRepository;
    private final ProtocolNumberGenerator numberGenerator;
    private final ProtocolNormativeCheckService normativeCheckService;
    private final ProtocolDocumentGenerationService documentService;
    private final ProtocolAuditService auditService;
    private final FileStorageService fileStorageService;
    private final CmsSignatureValidator cmsSignatureValidator;
    private final SignatureVerificationService signatureVerificationService;
    private final ProtocolApiMapper mapper;
    private final ObjectMapper objectMapper;
    private final ProtocolValidationPolicyRegistry validationPolicyRegistry;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final ProtocolIdempotencyService idempotencyService;
    private final ProtocolSignatureRepository signatureRepository;
    private final ProtocolSigningProperties signingProperties;
    private final kz.eco.user.UserRepository userRepository;
    private final ProtocolPermissionService permissionService;
    private final ProtocolMutationGuard mutationGuard;

    public ProtocolService(ProtocolRepository protocolRepository,
                           ProtocolTemplateRepository templateRepository,
                           CompanyRepository companyRepository,
                           CompanyObjectRepository companyObjectRepository,
                           LaboratoryRepository laboratoryRepository,
                           LaboratoryService laboratoryService,
                           ProtocolResultRepository resultRepository,
                           MeasurementDeviceRepository deviceRepository,
                           ProtocolEnvironmentConditionsRepository envConditionsRepository,
                           ProtocolNumberGenerator numberGenerator,
                           ProtocolNormativeCheckService normativeCheckService,
                           ProtocolDocumentGenerationService documentService,
                           ProtocolAuditService auditService,
                           FileStorageService fileStorageService,
                           CmsSignatureValidator cmsSignatureValidator,
                           SignatureVerificationService signatureVerificationService,
                           ProtocolApiMapper mapper,
                           ObjectMapper objectMapper,
                           ProtocolValidationPolicyRegistry validationPolicyRegistry,
                           OrderRepository orderRepository,
                           OrderService orderService,
                           ProtocolIdempotencyService idempotencyService,
                           ProtocolSignatureRepository signatureRepository,
                           ProtocolSigningProperties signingProperties,
                           kz.eco.user.UserRepository userRepository,
                           ProtocolPermissionService permissionService,
                           ProtocolMutationGuard mutationGuard) {
        this.protocolRepository = protocolRepository;
        this.templateRepository = templateRepository;
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.laboratoryRepository = laboratoryRepository;
        this.laboratoryService = laboratoryService;
        this.resultRepository = resultRepository;
        this.deviceRepository = deviceRepository;
        this.envConditionsRepository = envConditionsRepository;
        this.numberGenerator = numberGenerator;
        this.normativeCheckService = normativeCheckService;
        this.documentService = documentService;
        this.auditService = auditService;
        this.fileStorageService = fileStorageService;
        this.cmsSignatureValidator = cmsSignatureValidator;
        this.signatureVerificationService = signatureVerificationService;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.validationPolicyRegistry = validationPolicyRegistry;
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.idempotencyService = idempotencyService;
        this.signatureRepository = signatureRepository;
        this.signingProperties = signingProperties;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.mutationGuard = mutationGuard;
    }

    /**
     * Returns only the protocol types the backend can actually create documents for right now:
     * registered in ProtocolTypeRegistry AND with a real DOCX template on the classpath
     * (ProtocolTypeConfig.active(), checked once at class-init - see ProtocolTypeRegistry.config).
     */
    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.ProtocolTemplateResponse> listTemplates() {
        return ProtocolTypeRegistry.findActive().stream()
                .map(config -> {
                    ProtocolTemplateCode dbCode = ProtocolTemplateCode.fromApi(config.templateId());
                    String name = dbCode == null ? config.title() : templateRepository.findByCode(dbCode.name())
                            .map(ProtocolTemplate::getName)
                            .orElse(config.title());
                    return new ProtocolApiDtos.ProtocolTemplateResponse(
                            config.templateId(), name, config.title(),
                            config.sourceDocumentCode(), config.docxTemplateCode(),
                            config.normativeTemplateId(), config.resultMode().name(),
                            config.defaultUnit(), config.active());
                })
                .toList();
    }

    private static final java.util.Set<Integer> ALLOWED_PAGE_SIZES = java.util.Set.of(10, 20, 25, 50, 100);
    private static final java.util.Set<String> ALLOWED_SORT_FIELDS =
            java.util.Set.of("protocolDate", "createdAt", "updatedAt", "protocolNumber", "status");

    /** Old no-filter callers (kept for any internal caller still using it) - the actual
     *  GET /api/protocols endpoint always goes through the paginated overload below. */
    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.ProtocolResponse> list() {
        return protocolRepository.findAllByStatusNotOrderByCreatedAtDesc(ProtocolStatus.ARCHIVED).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public kz.eco.common.PageResponse<ProtocolApiDtos.ProtocolListItemDto> list(
            String search, ProtocolStatus status, String templateId, String subtype,
            Long companyId, Long objectId, Long laboratoryId, Long executorId, String compliance,
            LocalDate dateFrom, LocalDate dateTo, Integer page, Integer size, String sort, boolean includeArchived) {
        int resolvedPage = page != null && page >= 0 ? page : 0;
        int resolvedSize = resolvePageSize(size);
        String templateCode = null;
        if (templateId != null && !templateId.isBlank()) {
            templateCode = ProtocolTemplateCode.fromCode(templateId, subtype).name();
        }
        String normalizedSearch = search != null && !search.isBlank() ? search.trim() : null;
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(resolvedPage, resolvedSize, resolveSort(sort));

        var pageResult = protocolRepository.search(status, templateCode, subtype, companyId, objectId,
                laboratoryId, executorId, compliance, dateFrom, dateTo, normalizedSearch, includeArchived, pageable);
        // Batch-load every signature row for the whole page in ONE query, then group in memory -
        // avoids a per-row signatureRepository query (the N+1 the paginated list was designed to
        // avoid in the first place, see ProtocolListItemDto's javadoc).
        List<Long> pageProtocolIds = pageResult.getContent().stream().map(Protocol::getId).toList();
        Map<Long, List<ProtocolSignature>> signaturesByProtocolId = pageProtocolIds.isEmpty()
                ? Map.of()
                : signatureRepository.findAllByProtocolIdIn(pageProtocolIds).stream()
                        .collect(java.util.stream.Collectors.groupingBy(ProtocolSignature::getProtocolId));
        kz.eco.user.User currentUser = kz.eco.auth.CurrentUser.getOrNull();
        return kz.eco.common.PageResponse.of(pageResult,
                p -> toListItem(p, signaturesByProtocolId.getOrDefault(p.getId(), List.of()), currentUser));
    }

    private int resolvePageSize(Integer size) {
        if (size == null) {
            return 25;
        }
        if (!ALLOWED_PAGE_SIZES.contains(size)) {
            throw new kz.eco.common.exception.ValidationException("Недопустимый размер страницы",
                    List.of(new kz.eco.common.ApiFieldError("size", "INVALID_PAGE_SIZE",
                            "Разрешённые размеры страницы: " + ALLOWED_PAGE_SIZES)));
        }
        return size;
    }

    private org.springframework.data.domain.Sort resolveSort(String sortParam) {
        String effective = sortParam != null && !sortParam.isBlank() ? sortParam : "createdAt,desc";
        String[] parts = effective.split(",", 2);
        String field = parts[0].trim();
        if (!ALLOWED_SORT_FIELDS.contains(field)) {
            throw new kz.eco.common.exception.ValidationException("Недопустимое поле сортировки",
                    List.of(new kz.eco.common.ApiFieldError("sort", "INVALID_SORT_FIELD",
                            "Разрешённые поля сортировки: " + ALLOWED_SORT_FIELDS)));
        }
        org.springframework.data.domain.Sort.Direction direction =
                parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                        ? org.springframework.data.domain.Sort.Direction.ASC
                        : org.springframework.data.domain.Sort.Direction.DESC;
        return org.springframework.data.domain.Sort.by(direction, field);
    }

    /** Enriched with the same version/permissions/signature/file/publish/lineage fields the
     *  detail DTO exposes (audit finding: the list view previously forced a client to fetch every
     *  row's detail just to know e.g. its version or whether it can be signed) - signatures are
     *  passed in already batch-loaded for the whole page (see list()) so this stays free of any
     *  per-row query. */
    private ProtocolApiDtos.ProtocolListItemDto toListItem(Protocol p, List<ProtocolSignature> signatures,
                                                           kz.eco.user.User currentUser) {
        ProtocolTemplateCode code = ProtocolTemplateCode.fromDbCode(p.getTemplateCode());
        String apiTemplateId = code != null ? code.toApiId() : (p.getTemplateCode() != null ? p.getTemplateCode().toLowerCase(Locale.ROOT) : null);
        List<ProtocolSignature> currentVersionSignatures = signatures.stream()
                .filter(s -> s.getProtocolVersion() != null && s.getProtocolVersion().equals(p.getVersion()))
                .toList();
        boolean signedByCurrentUser = currentUser != null && currentVersionSignatures.stream()
                .anyMatch(s -> s.getUserId().equals(currentUser.getId()));
        return new ProtocolApiDtos.ProtocolListItemDto(
                String.valueOf(p.getId()),
                p.getProtocolNumber(),
                apiTemplateId,
                code != null ? code.title() : null,
                p.getSubtype(),
                p.getStatus().name(),
                ProtocolApiMapper.formatDate(p.getProtocolDate()),
                p.getCompanyId(),
                p.getCompanyNameSnapshot(),
                p.getCompanyBinSnapshot(),
                p.getObjectId(),
                p.getObjectNameSnapshot(),
                p.getLaboratoryId(),
                p.getLaboratoryName(),
                p.getExecutorId(),
                p.getExecutorName(),
                p.getComplianceStatus(),
                ProtocolApiMapper.formatDateTime(p.getCreatedAt()),
                ProtocolApiMapper.formatDateTime(p.getUpdatedAt()),
                p.getVersion(),
                permissionService.calculate(p, currentUser, currentVersionSignatures.size(), signedByCurrentUser),
                currentVersionSignatures.size(),
                signingProperties.getMaxSignatures(),
                p.getDocxFileId() != null,
                p.getPdfFileId() != null,
                p.getDocxFileId(),
                p.getPdfFileId(),
                ProtocolApiMapper.formatDateTime(p.getPublishedAt()),
                p.getPublishedBy(),
                p.getReplacedProtocolId() != null ? String.valueOf(p.getReplacedProtocolId()) : null,
                p.getReplacedByProtocolId() != null ? String.valueOf(p.getReplacedByProtocolId()) : null,
                p.getOrderId(),
                // PEK linkage now lives in kz.eco.pek.PekReportProtocolSource (see that table),
                // not as a column on Protocol - not surfaced in the bulk list view in this pass
                // since that would require an extra per-page join; use the PEK report's own
                // source list to find which protocols it references instead.
                null,
                null
        );
    }

    @Transactional(readOnly = true)
    public ProtocolApiDtos.ProtocolResponse get(Long id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse create(ProtocolApiDtos.CreateProtocolRequest request, Long userId) {
        validateCreateRequest(request);
        ProtocolTemplate template = resolveTemplate(request.templateId(), request.subtype());
        if (request.companyId() == null) {
            throw new BadRequestException("Компания не найдена");
        }
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new NotFoundException("Компания не найдена"));
        if (company.getStatus() == CompanyStatus.ARCHIVED) {
            throw new BadRequestException("Нельзя создать протокол для архивной компании");
        }
        Protocol protocol = new Protocol();
        protocol.setTemplateId(template.getId());
        protocol.setTemplateCode(template.getCode());
        protocol.setSubtype(request.subtype());
        protocol.setFormCode(request.formCode());
        protocol.setAppendixNumber(request.appendixNumber());
        protocol.setProtocolDate(ProtocolApiMapper.parseDate(request.protocolDate()));
        copyCompanySnapshotToProtocol(company, protocol);
        protocol.setOrganizationName(company.getName());
        protocol.setOrganizationAddress(company.getLegalAddress() != null ? company.getLegalAddress() : company.getActualAddress());
        protocol.setObjectName(company.getObjectName());
        protocol.setProductName(trim(request.productName()));
        protocol.setTestingBasis(trim(request.testingBasis()));
        protocol.setProductNormativeDocument(trim(request.productNormativeDocument()));
        protocol.setSamplingMethodDocument(trim(request.samplingMethodDocument()));
        protocol.setTestingMethodDocument(trim(request.testingMethodDocument()));
        protocol.setSampleDate(ProtocolApiMapper.parseDate(firstNonBlank(
                request.sampleDate(), request.samplingDate(), request.measurementDate())));
        protocol.setTestingStartDate(ProtocolApiMapper.parseDate(request.testingStartDate()));
        protocol.setTestingEndDate(ProtocolApiMapper.parseDate(request.testingEndDate()));
        protocol.setTestDate(ProtocolApiMapper.parseDate(firstNonBlank(
                request.testingEndDate(), request.testingDate(), request.testingStartDate(), request.measurementDate())));
        protocol.setTestPurpose(trim(firstNonBlank(request.purpose(), request.testPurpose(), request.testingPurpose())));
        protocol.setTestingPurpose(trim(firstNonBlank(request.testingPurpose(), request.purpose(), request.testPurpose())));
        protocol.setEnvironmentConditions(trim(firstNonBlank(
                request.environmentalConditions(), request.environmentConditions())));
        boolean autoGeneratedNumber = request.protocolNumber() == null || request.protocolNumber().isBlank();
        if (!autoGeneratedNumber) {
            protocol.setProtocolNumber(request.protocolNumber().trim());
        } else {
            protocol.setProtocolNumber(numberGenerator.generate(template, protocol.getProtocolDate()));
        }

        applyObjectFromRequest(protocol, company, request);
        applyLaboratoryFromRequest(protocol, request);
        protocol.setMeasurementTime(trim(request.measurementTime()));
        protocol.setSourceNumber(sanitizeSourceNumber(request.sourceNumber()));
        if (request.measurementPlace() != null && !request.measurementPlace().isBlank()) {
            protocol.setSamplingLocationSnapshot(trim(request.measurementPlace()));
        }
        mapper.applyPrintVisibility(protocol, request.printVisibility());

        protocol.setStatus(ProtocolStatus.DRAFT);
        protocol.setCreatedBy(userId);
        saveProtocolWithNumberRetry(protocol, template, autoGeneratedNumber);

        if (request.environment() != null) {
            saveEnvironmentConditions(protocol.getId(), request.environment());
        }

        auditService.log(protocol.getId(), ProtocolAuditAction.CREATED, null, ProtocolStatus.DRAFT, userId,
                "Протокол создан на основе компании: " + company.getName() + ", БИН: " + company.getBin());
        return toResponse(protocol);
    }

    /**
     * sampleDate/testingStartDate/testingEndDate are kept separate from measurementDate whenever
     * the request actually supplies them - only when a field is absent does it fall back
     * (documented, backward-compat only): sampleDate -> measurementDate, testingStartDate ->
     * measurementDate, testingEndDate -> testingStartDate (after ITS fallback). This replaces the
     * previous behavior where measurementDate was copied into every date field unconditionally,
     * and where QuickCreateProtocolRequest didn't even have sampleDate/testingStartDate/
     * testingEndDate fields to receive them from the request in the first place.
     */
    /**
     * Idempotency-Key (optional header, see ProtocolController): a double-click or client retry
     * with the same key and the same request body returns the original protocol instead of
     * creating a second one. begin() is called before any work starts; complete()/fail() bracket
     * the rest of the method so a genuine failure lets a later retry with the same key proceed
     * instead of getting stuck forever behind a PROCESSING row that will never finish.
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse quickCreate(ProtocolApiDtos.QuickCreateProtocolRequest request, Long userId,
                                                        String idempotencyKey) {
        var outcome = idempotencyService.begin(userId, idempotencyKey, request);
        if (outcome instanceof ProtocolIdempotencyService.ReturnExisting existing) {
            return get(existing.protocolId());
        }
        Long idempotencyRecordId = ((ProtocolIdempotencyService.Proceed) outcome).recordId();
        try {
            ProtocolApiDtos.ProtocolResponse response = doQuickCreate(request, userId);
            idempotencyService.complete(idempotencyRecordId, Long.parseLong(response.id()));
            return response;
        } catch (RuntimeException ex) {
            if (ex instanceof DataIntegrityViolationException dive) {
                // Log the real cause with enough context to actually diagnose it (never shown to
                // the client - see GlobalExceptionHandler.handleDataIntegrityViolation). No JWT,
                // personal data, or document content is included, only the identifiers already
                // present in the request.
                log.error("Protocol quick-create data integrity error: templateId={}, companyId={}, "
                                + "objectId={}, laboratoryId={}, executorId={}, rootCause={}",
                        request.templateId(), request.companyId(), request.objectId(),
                        request.laboratoryId(), request.executorId(),
                        NestedExceptionUtils.getMostSpecificCause(dive).getMessage(), dive);
            }
            idempotencyService.fail(idempotencyRecordId);
            throw ex;
        }
    }

    private ProtocolApiDtos.ProtocolResponse doQuickCreate(ProtocolApiDtos.QuickCreateProtocolRequest request, Long userId) {
        validateQuickCreateRequest(request);
        String measurementDate = request.measurementDate().trim();
        String sampleDate = firstNonBlank(request.sampleDate(), measurementDate);
        String testingStartDate = firstNonBlank(request.testingStartDate(), measurementDate);
        String testingEndDate = firstNonBlank(request.testingEndDate(), testingStartDate);
        ProtocolApiDtos.CreateProtocolRequest createRequest = new ProtocolApiDtos.CreateProtocolRequest(
                request.templateId(),
                request.companyId(),
                request.objectId(),
                null,
                request.protocolDate(),
                sampleDate,
                sampleDate,
                null,
                testingStartDate,
                testingEndDate,
                null, null, null, null, null, null, null, null, null, null,
                request.subtype(),
                null, null,
                null,
                measurementDate,
                request.measurementTime(),
                request.measurementPlace(),
                request.sourceNumber(),
                request.laboratoryId(),
                request.executorId(),
                request.printVisibility()
        );
        ProtocolApiDtos.ProtocolResponse created = create(createRequest, userId);
        Long protocolId = Long.parseLong(created.id());
        Protocol protocol = getOrThrow(protocolId);
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new NotFoundException("Компания не найдена"));
        writeCompanySnapshotJson(protocol, company);
        if (request.orderId() != null && !request.orderId().isBlank()) {
            linkOrder(protocol, request.orderId());
        }
        protocolRepository.save(protocol);

        ProtocolTemplate templateEntity = template(protocol.getTemplateId());
        LocalDate onDate = ProtocolApiMapper.parseDate(measurementDate);
        ProtocolTypeConfig typeConfig = ProtocolTypeRegistry.require(request.templateId(), request.subtype());
        applyQuickCreateEnvironmentConditions(protocol.getId(), request.conditions());

        for (ProtocolApiDtos.QuickCreateMeasurement measurement : request.measurements()) {
            addQuickCreateMeasurement(protocol, templateEntity, request, measurement, typeConfig, onDate);
        }

        auditService.log(protocolId, ProtocolAuditAction.UPDATED, ProtocolStatus.DRAFT, ProtocolStatus.DRAFT, userId,
                "Быстрое создание: добавлено строк " + request.measurements().size());
        return checkNormatives(protocolId, userId);
    }

    /**
     * The counter-backed generator (ProtocolNumberCounterService) makes a genuine number
     * collision extremely rare, but not provably impossible (e.g. a counter row manually edited
     * out of sync with lab_protocols) - so a single controlled retry stays cheap insurance rather
     * than trusting the lock alone. Only regenerates when the number was auto-generated in the
     * first place: if the caller explicitly supplied protocolNumber, silently replacing their
     * chosen value would be surprising, so that case fails straight to PROTOCOL_NUMBER_CONFLICT
     * instead. Any OTHER constraint violation (FK, not-null, ...) is rethrown as-is immediately -
     * retrying those would just fail identically every time.
     */
    private void saveProtocolWithNumberRetry(Protocol protocol, ProtocolTemplate template, boolean autoGeneratedNumber) {
        try {
            protocolRepository.saveAndFlush(protocol);
        } catch (DataIntegrityViolationException ex) {
            boolean numberAlreadyTaken = protocolRepository.findByProtocolNumber(protocol.getProtocolNumber()).isPresent();
            if (!numberAlreadyTaken || !autoGeneratedNumber) {
                throw ex;
            }
            protocol.setProtocolNumber(numberGenerator.generate(template, protocol.getProtocolDate()));
            try {
                protocolRepository.saveAndFlush(protocol);
            } catch (DataIntegrityViolationException ex2) {
                throw new ConflictException(
                        "Не удалось зарезервировать номер протокола. Повторите операцию.",
                        "PROTOCOL_NUMBER_CONFLICT");
            }
        }
    }

    private static final int SOURCE_NUMBER_MAX_LENGTH = 80;

    /** Trims, strips control characters (keeps full Unicode incl. Cyrillic/Kazakh), and caps
     *  length to the column size - so unusual input (stray quote/control character, an
     *  over-length value) can never reach the database abnormally. Never rewrites the visible
     *  text itself - a legitimate value like "№12-Ә" round-trips unchanged. */
    private static String sanitizeSourceNumber(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        StringBuilder cleaned = new StringBuilder(trimmed.length());
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            // Strip C0/C1 control characters (including stray quote-adjacent artifacts) but keep
            // every printable Unicode character, including Cyrillic/Kazakh letters.
            if (!Character.isISOControl(c)) {
                cleaned.append(c);
            }
        }
        String result = cleaned.toString().trim();
        if (result.isEmpty()) {
            return null;
        }
        return result.length() > SOURCE_NUMBER_MAX_LENGTH ? result.substring(0, SOURCE_NUMBER_MAX_LENGTH) : result;
    }

    private void applyQuickCreateEnvironmentConditions(Long protocolId, ProtocolApiDtos.QuickCreateConditions conditions) {
        if (conditions == null) {
            return;
        }
        java.math.BigDecimal temperature = parseDecimalSafe(conditions.temperature());
        java.math.BigDecimal humidity = parseDecimalSafe(conditions.humidity());
        java.math.BigDecimal pressure = parseDecimalSafe(conditions.pressure());
        java.math.BigDecimal windSpeed = parseDecimalSafe(conditions.windSpeed());
        boolean hasWeatherMetadata = !isBlank(conditions.weatherSource()) || !isBlank(conditions.weatherDataSource())
                || !isBlank(conditions.manualChangeReason()) || !isBlank(conditions.weatherObservedAt());
        if (temperature == null && humidity == null && pressure == null && windSpeed == null && !hasWeatherMetadata) {
            return;
        }
        saveEnvironmentConditions(protocolId, new ProtocolApiDtos.EnvironmentData(
                temperature, null, null,
                humidity, null, null,
                pressure, null,
                windSpeed,
                null,
                conditions.weatherSource(),
                conditions.weatherDataSource(),
                conditions.weatherObservedAt(),
                null,
                conditions.manualChangeReason()
        ));
    }

    private static java.math.BigDecimal parseDecimalSafe(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new java.math.BigDecimal(raw.trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse update(Long id, ProtocolApiDtos.UpdateProtocolRequest request, Long userId) {
        Protocol protocol = getEditableOrThrow(id);
        if (request.version() != null && !request.version().equals(protocol.getVersion())) {
            throw new ConflictException("Протокол был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }
        ProtocolTemplate template = template(protocol.getTemplateId());
        if (request.number() != null && !request.number().isBlank()) {
            if (protocol.getStatus() == ProtocolStatus.APPROVED || protocol.getStatus() == ProtocolStatus.SIGNED) {
                throw new BadRequestException("Нельзя менять номер утверждённого протокола");
            }
            protocol.setProtocolNumber(request.number().trim());
        }
        if (request.protocolDate() != null) protocol.setProtocolDate(ProtocolApiMapper.parseDate(request.protocolDate()));
        if (request.objectId() != null) applyObjectChange(protocol, request.objectId());
        if (request.executorId() != null) {
            // executorId always wins over the raw "executor" display-name string - the snapshot
            // is rebuilt from the resolved employee, never trusted from client input (spec §11).
            applyExecutorChange(protocol, request.executorId());
        } else if (request.executor() != null) {
            protocol.setExecutorName(request.executor());
        }
        if (request.approver() != null) protocol.setHeadOfLaboratoryName(request.approver());
        if (request.formCode() != null) protocol.setFormCode(request.formCode());
        if (request.appendixNumber() != null) protocol.setAppendixNumber(request.appendixNumber());
        if (request.measurementTime() != null) protocol.setMeasurementTime(request.measurementTime());
        if (request.measurementPlace() != null) protocol.setSamplingLocationSnapshot(trim(request.measurementPlace()));
        // measurementDate only fills sampleDate when testing.samplingDate didn't already supply
        // it - it must never blindly overwrite every date field (spec §9).
        if (request.measurementDate() != null
                && (request.testing() == null || request.testing().samplingDate() == null)) {
            protocol.setSampleDate(ProtocolApiMapper.parseDate(request.measurementDate()));
        }
        mapper.applyLaboratory(protocol, request.laboratory());
        mapper.applyOrganization(protocol, request.organization());
        mapper.applyTesting(protocol, mergeTestingData(request.testing(), request.testingMethodDocument()));
        if (request.instruments() != null) mapper.writeInstruments(protocol, request.instruments());
        if (request.results() != null && !request.results().isEmpty()) {
            syncResults(protocol, template.getCode(), request.results());
        }
        if (request.environment() != null) saveEnvironmentConditions(protocol.getId(), request.environment());
        if (request.explanatoryNote() != null) protocol.setExplanatoryNote(request.explanatoryNote());
        if (request.subtype() != null) protocol.setSubtype(request.subtype());
        if (request.complianceDocument() != null) protocol.setComplianceDocument(request.complianceDocument());
        mapper.applyPrintVisibility(protocol, request.printVisibility());
        if (request.testingStartDate() != null) protocol.setTestingStartDate(ProtocolApiMapper.parseDate(request.testingStartDate()));
        if (request.testingEndDate() != null) {
            protocol.setTestingEndDate(ProtocolApiMapper.parseDate(request.testingEndDate()));
            protocol.setTestDate(ProtocolApiMapper.parseDate(request.testingEndDate()));
        }
        if (protocol.getTestingStartDate() != null && protocol.getTestingEndDate() != null
                && protocol.getTestingEndDate().isBefore(protocol.getTestingStartDate())) {
            throw new BadRequestException("Дата окончания испытаний не может быть раньше даты начала");
        }
        // Any previously generated files are now stale; clear them so the next download
        // (downloadDocx/downloadPdf) renders fresh content from the edited data.
        protocol.setDocxFileId(null);
        protocol.setPdfFileId(null);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, null);
        return toResponse(protocol);
    }

    /** PATCH's objectId always means company_objects.id, scoped to the protocol's existing
     *  company - never a bare company id (spec §10: forbid objectId == companyId for new/changed
     *  values, even though the legacy create()-time fallback still tolerates it for old data). */
    private void applyObjectChange(Protocol protocol, Long objectId) {
        if (objectId.equals(protocol.getObjectId())) {
            return;
        }
        if (objectId.equals(protocol.getCompanyId())) {
            throw new BadRequestException("objectId должен указывать на объект компании, а не на саму компанию");
        }
        CompanyObject object = companyObjectRepository.findById(objectId)
                .orElseThrow(() -> new NotFoundException("Объект не найден: " + objectId));
        if (protocol.getCompanyId() != null && !protocol.getCompanyId().equals(object.getCompanyId())) {
            throw new BadRequestException("Объект не принадлежит компании протокола");
        }
        if (!"ACTIVE".equalsIgnoreCase(object.getStatus())) {
            throw new BadRequestException("Объект архивирован");
        }
        protocol.setObjectId(object.getId());
        protocol.setObjectName(object.getName());
        protocol.setObjectNameSnapshot(object.getName());
        protocol.setObjectAddressSnapshot(object.getAddress());
        protocol.setActivityTypeSnapshot(object.getActivityType());
        writeObjectSnapshot(protocol, object, protocol.getSourceNumber());
    }

    /** Resolves the real LaboratoryEmployee and rebuilds the executor snapshot from it - never
     *  trusts a client-supplied display name (spec §11). */
    private void applyExecutorChange(Protocol protocol, Long executorId) {
        if (protocol.getLaboratoryId() == null) {
            throw new BadRequestException(
                    "У протокола не задана лаборатория. Сначала выполните обновление данных лаборатории.");
        }
        LaboratoryEmployee employee = resolveExecutorEmployee(protocol.getLaboratoryId(), executorId);
        protocol.setExecutorId(employee.getId());
        protocol.setExecutorName(employee.getFullName());
    }

    /**
     * PATCH accepts the shared "НД на методы испытаний" field either flat
     * ({"testingMethodDocument": "..."}) or nested ({"testing": {"testingMethodDocument": "..."}}).
     * A value already present in the nested object takes priority; the flat field only fills it
     * in when the nested object omits it (or is absent entirely).
     */
    private ProtocolApiDtos.TestingData mergeTestingData(ProtocolApiDtos.TestingData testing, String flatTestingMethodDocument) {
        if (flatTestingMethodDocument == null || flatTestingMethodDocument.isBlank()) {
            return testing;
        }
        if (testing == null) {
            return new ProtocolApiDtos.TestingData(null, null, flatTestingMethodDocument, null, null, null, null, null);
        }
        if (testing.testingMethodDocument() != null && !testing.testingMethodDocument().isBlank()) {
            return testing;
        }
        return new ProtocolApiDtos.TestingData(
                testing.productNormativeDocument(), testing.samplingMethodDocument(), flatTestingMethodDocument,
                testing.samplingDate(), testing.testingDate(), testing.testingPurpose(),
                testing.environmentConditions(), testing.physicalFactorType());
    }

    /**
     * True physical delete - only ever allowed for an empty DRAFT (no results attached), and only
     * by ADMIN (enforced again here, not just at @PreAuthorize, since this is destructive and
     * irreversible). Every other case must go through cancel()/archive() instead, which keep the
     * record as history. This replaces the previous behavior where DELETE silently soft-archived
     * any non-signed/non-replaced protocol regardless of status or content.
     */
    @Transactional
    public void delete(Long id, Long userId) {
        Protocol protocol = getOrThrow(id);
        if (protocol.getStatus() != ProtocolStatus.DRAFT) {
            throw new ConflictException(
                    "Физическое удаление разрешено только для пустого черновика", "PROTOCOL_NOT_DELETABLE");
        }
        if (!resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty()) {
            throw new ConflictException(
                    "Нельзя удалить черновик с введёнными результатами. Сначала удалите строки результатов.",
                    "PROTOCOL_NOT_DELETABLE");
        }
        auditService.log(id, ProtocolAuditAction.DELETED, protocol.getStatus(), null, userId,
                "Черновик удалён физически");
        envConditionsRepository.findByProtocolId(id).ifPresent(envConditionsRepository::delete);
        protocolRepository.delete(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse readyForApproval(Long id, Long userId) {
        return readyForApproval(id, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse readyForApproval(Long id, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.READY_FOR_APPROVAL);
        validateReadyForApproval(protocol);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.READY_FOR_APPROVAL);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.UPDATED, old, protocol.getStatus(), userId, "Готов к утверждению");
        return toResponse(protocol);
    }

    /** Sends a protocol back for revision (NEEDS_REVISION) instead of all the way to DRAFT -
     *  distinct from returnToDraft(), which is the older, coarser reset. */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnForRevision(Long id, Long userId, String comment) {
        return returnForRevision(id, null, comment, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnForRevision(Long id, Long version, String reason, Long userId) {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.NEEDS_REVISION);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.NEEDS_REVISION);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.UPDATED, old, protocol.getStatus(), userId,
                reason != null && !reason.isBlank() ? reason : "Возвращён на доработку");
        return toResponse(protocol);
    }

    private void requireTransition(Protocol protocol, ProtocolStatus target) {
        if (!protocol.getStatus().canTransitionTo(target)) {
            throw new ConflictException(
                    "Переход из " + protocol.getStatus() + " в " + target + " недопустим",
                    "PROTOCOL_INVALID_TRANSITION");
        }
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse approve(Long id, Long userId) throws IOException {
        return approve(id, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse approve(Long id, Long version, Long userId) throws IOException {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.APPROVED);
        validateBeforeApprove(protocol);
        documentService.generateDocx(id, userId);
        documentService.generatePdf(id, userId);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.APPROVED);
        protocol.setApprovedBy(userId);
        protocol.setApprovedAt(LocalDateTime.now());
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.APPROVED, old, protocol.getStatus(), userId, null);
        return toResponse(protocol);
    }

    /**
     * Multi-signature model (up to ProtocolSigningProperties.maxSignatures, default 5): the FIRST
     * signature for a protocol version transitions it to SIGNED exactly as before (and still
     * populates the legacy Protocol.signedBy/signedAt/signatureFileId/pdfSha256 fields for
     * backward compatibility); every additional signature from a DIFFERENT employee is accepted
     * while status stays SIGNED, recorded as its own row in protocol_signatures. A given user can
     * sign a given protocol version at most once. All signers verify against the SAME frozen PDF
     * (pdfSha256 comparison rejects signing if the content changed since the first signature -
     * PROTOCOL_CONTENT_CHANGED). protocolVersion on each row is Protocol.version at signing time,
     * which - by construction - only changes on the first signature's save() (nothing else about
     * the protocol is mutated by subsequent signers), so it stays stable as the "which
     * revision was this signed" key even though it's the same field JPA uses for optimistic
     * locking elsewhere.
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse sign(Long id, ProtocolApiDtos.SignProtocolRequest request, Long userId) throws IOException {
        Protocol protocol = getOrThrow(id);
        boolean additionalSigner = protocol.getStatus() == ProtocolStatus.SIGNED;
        // The simplified DRAFT -> CALCULATED -> READY -> SIGNED flow signs straight from READY;
        // the legacy READY_FOR_APPROVAL -> APPROVED -> SIGNED flow still works unchanged. Once
        // already SIGNED, additional signers don't go through a status transition at all.
        if (!additionalSigner) {
            requireTransition(protocol, ProtocolStatus.SIGNED);
        }
        // Publishing to the client closes the signature-collection window - a signer added after
        // publish would change what already went out without the client ever seeing it.
        if (protocol.getPublishedAt() != null) {
            throw new ConflictException("Протокол уже опубликован, дополнительные подписи невозможны",
                    "PROTOCOL_ALREADY_PUBLISHED");
        }
        if (signatureRepository.existsByProtocolIdAndProtocolVersionAndUserId(id, protocol.getVersion(), userId)) {
            throw new ConflictException("Вы уже подписали эту версию протокола", "PROTOCOL_ALREADY_SIGNED");
        }
        int maxSignatures = signingProperties.getMaxSignatures();
        long signatureCountBefore = signatureRepository.countByProtocolIdAndProtocolVersion(id, protocol.getVersion());
        if (signatureCountBefore >= maxSignatures) {
            throw new ConflictException("Достигнуто максимальное количество подписей", "SIGNATURE_LIMIT_REACHED");
        }
        // Checked against the protocol's own accreditation snapshot (frozen at creation), not a
        // fresh Laboratory lookup - the snapshot's validUntil date doesn't change, so comparing it
        // to "now" at sign time still correctly catches a protocol that sat around long enough for
        // that date to pass, without needing to re-read (or risk drifting from) the snapshot.
        if (protocol.getAccreditationValidUntil() != null
                && protocol.getAccreditationValidUntil().isBefore(LocalDate.now())) {
            throw new ConflictException("Аттестат лаборатории истёк на момент подписания",
                    "LABORATORY_ACCREDITATION_EXPIRED");
        }
        validateBeforeSign(protocol);
        // CMS is mandatory for every sign - the old "sign with a plain JSON marker when no CMS is
        // given" fallback (gated only by an opt-in eco.signature.require-cms flag) let anyone flip
        // a protocol to SIGNED with no real signature at all (spec §23: "CMS обязательна").
        String cms = request != null ? request.cmsSignatureBase64() : null;
        if (cms == null || cms.isBlank()) {
            throw new BadRequestException("Подпись CMS обязательна для подписания протокола");
        }
        cmsSignatureValidator.validate(cms);
        if (protocol.getPdfFileId() == null) {
            documentService.generatePdf(id, userId);
            protocol = getOrThrow(id);
        }
        byte[] pdfBytes;
        try {
            pdfBytes = fileStorageService.load(protocol.getPdfFileId()).inputStream().readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Не удалось прочитать PDF протокола для проверки подписи", ex);
        }
        // Cryptographically verifies the CMS signature AND that it actually covers this exact
        // PDF (byte-for-byte, via SHA-256 comparison for attached CMS / reconstruction for
        // detached CMS) - throws if the signature is invalid, the certificate/signer info is
        // missing, or the signed content doesn't match pdfBytes (spec §23 steps 1-10).
        SignatureInfo signatureInfo = signatureVerificationService.verifyDocument(cms, pdfBytes);
        String currentPdfSha256 = sha256Hex(pdfBytes);
        if (additionalSigner && protocol.getPdfSha256() != null
                && !protocol.getPdfSha256().equalsIgnoreCase(currentPdfSha256)) {
            throw new ConflictException("Финальный документ был изменён", "PROTOCOL_CONTENT_CHANGED");
        }
        if (protocol.getApprovedAt() == null) {
            protocol.setApprovedBy(userId);
            protocol.setApprovedAt(LocalDateTime.now());
        }
        var sig = fileStorageService.storeBytes(
                cms.getBytes(StandardCharsets.UTF_8),
                protocol.getProtocolNumber() + "-signature-" + userId + ".cms",
                "application/pkcs7-mime",
                "protocol-" + id, String.valueOf(userId));
        ProtocolStatus old = protocol.getStatus();
        if (!additionalSigner) {
            protocol.setSignatureFileId(sig.fileId());
            protocol.setPdfSha256(currentPdfSha256);
            protocol.setSignatureCertificateMetadata(writeCertificateMetadata(signatureInfo));
            protocol.setStatus(ProtocolStatus.SIGNED);
            protocol.setSignedBy(userId);
            protocol.setSignedAt(LocalDateTime.now());
            protocolRepository.save(protocol);
        }
        Long signingVersion = protocol.getVersion();
        kz.eco.user.User signer = userRepository.findById(userId).orElse(null);
        ProtocolSignature signature = new ProtocolSignature();
        signature.setProtocolId(id);
        signature.setProtocolVersion(signingVersion);
        signature.setUserId(userId);
        signature.setSignerFullName(signer != null && signer.getName() != null ? signer.getName() : signatureInfo.commonName());
        signature.setSignerPosition(signer != null ? signer.getPosition() : null);
        signature.setPdfSha256(currentPdfSha256);
        signature.setSignedAt(java.time.Instant.now());
        signature.setCreatedAt(java.time.Instant.now());
        try {
            signatureRepository.saveAndFlush(signature);
        } catch (DataIntegrityViolationException dive) {
            // The unique (protocol_id, protocol_version, user_id) constraint is the last line of
            // defense against a genuine double-click race that slipped past the existsBy check
            // above - never let it surface as a raw 500.
            throw new ConflictException("Вы уже подписали эту версию протокола", "PROTOCOL_ALREADY_SIGNED");
        }
        auditService.log(id, ProtocolAuditAction.SIGNED, old, protocol.getStatus(), userId,
                (additionalSigner ? "Дополнительный подписант: " : "Подписант: ")
                        + signatureInfo.commonName() + ", ИИН: " + signatureInfo.serialNumber()
                        + ", подписей: " + (signatureCountBefore + 1) + "/" + maxSignatures);
        return toResponse(protocol);
    }

    private String writeCertificateMetadata(SignatureInfo info) {
        try {
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("subjectDN", info.subjectDN());
            metadata.put("commonName", info.commonName());
            metadata.put("serialNumber", info.serialNumber());
            metadata.put("organization", info.organization());
            metadata.put("verified", info.verified());
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception ex) {
            return null;
        }
    }

    private static String sha256Hex(byte[] data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse replace(Long id, ProtocolApiDtos.ReplaceProtocolRequest request, Long userId) {
        Protocol old = getOrThrow(id);
        checkVersion(old, request.version());
        if (old.getStatus() != ProtocolStatus.SIGNED) {
            throw new BadRequestException("Замена доступна только для подписанных протоколов");
        }
        ProtocolTemplate template = template(old.getTemplateId());
        ProtocolStatus oldStatus = old.getStatus();
        old.setStatus(ProtocolStatus.REPLACED);

        Protocol copy = cloneProtocol(old, template, userId, id, request.reason());
        copy.setInstrumentsJson(old.getInstrumentsJson());
        copy.setOrderId(old.getOrderId());
        protocolRepository.save(copy);
        // Forward pointer completes the bidirectional chain (spec §24) - the backward pointer
        // (copy.replacedProtocolId = old.id) is already set inside cloneProtocol().
        old.setReplacedByProtocolId(copy.getId());
        protocolRepository.save(old);
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(id);
        int row = 1;
        for (ProtocolResult r : results) {
            resultRepository.save(ProtocolResultMapper.copy(r, copy.getId(), row++));
        }
        envConditionsRepository.findByProtocolId(id).ifPresent(source -> {
            ProtocolEnvironmentConditions cloned = new ProtocolEnvironmentConditions();
            cloned.setProtocolId(copy.getId());
            cloned.setTemperatureC(source.getTemperatureC());
            cloned.setTemperatureMinC(source.getTemperatureMinC());
            cloned.setTemperatureMaxC(source.getTemperatureMaxC());
            cloned.setHumidityPercent(source.getHumidityPercent());
            cloned.setHumidityMinPercent(source.getHumidityMinPercent());
            cloned.setHumidityMaxPercent(source.getHumidityMaxPercent());
            cloned.setPressureKpa(source.getPressureKpa());
            cloned.setWindSpeedMs(source.getWindSpeedMs());
            cloned.setConditionsComment(source.getConditionsComment());
            cloned.setSource(source.getSource());
            cloned.setDataSource(source.getDataSource());
            cloned.setManualChangeReason(source.getManualChangeReason());
            cloned.setWeatherObservedAt(source.getWeatherObservedAt());
            envConditionsRepository.save(cloned);
        });
        auditService.log(id, ProtocolAuditAction.REPLACED, oldStatus, ProtocolStatus.REPLACED, userId, request.reason());
        auditService.log(copy.getId(), ProtocolAuditAction.CREATED, null, ProtocolStatus.DRAFT, userId, "Копия протокола " + id);
        return toResponse(copy);
    }

    /** Validates the order exists and isn't already finished before linking it to a new protocol
     *  (spec §25) - a completed/cancelled order can't gain a new lab deliverable retroactively. */
    private void linkOrder(Protocol protocol, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Заявка не найдена: " + orderId));
        if (order.getStatus() == OrderStatus.COMPLETED || order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("Нельзя создать протокол для завершённой или отменённой заявки");
        }
        protocol.setOrderId(order.getId());
    }

    /**
     * Publishes the signed final PDF to the client (spec §26) - only ever from SIGNED, only the
     * exact bytes that were signed (re-verified by SHA-256 against the hash captured at sign time,
     * so a swapped/regenerated PDF is caught), and only the current (not superseded-by-correction)
     * version. This is the ONLY path that can move a linked order's laboratoryStatus to
     * result_ready (via OrderService.markLaboratoryResultReadyFromProtocol) - there is no manual
     * "upload any file as the final protocol" alternative.
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse publishToClient(Long id, Long version, Long userId) {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        if (protocol.getStatus() != ProtocolStatus.SIGNED) {
            throw new ConflictException("Публикация доступна только для подписанного протокола", "PROTOCOL_NOT_SIGNED");
        }
        if (protocol.getReplacedByProtocolId() != null) {
            throw new ConflictException("Существует более новая версия протокола — опубликуйте её", "PROTOCOL_REPLACED");
        }
        if (protocol.getPdfFileId() == null || protocol.getPdfSha256() == null) {
            throw new ConflictException("Финальный PDF отсутствует", "PROTOCOL_PDF_MISSING");
        }
        byte[] pdfBytes;
        try {
            pdfBytes = fileStorageService.load(protocol.getPdfFileId()).inputStream().readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Не удалось прочитать PDF протокола", ex);
        }
        if (!sha256Hex(pdfBytes).equals(protocol.getPdfSha256())) {
            throw new ConflictException("Файл PDF был изменён после подписания", "PROTOCOL_PDF_TAMPERED");
        }
        protocol.setPublishedAt(LocalDateTime.now());
        protocol.setPublishedBy(userId);
        protocolRepository.save(protocol);
        if (protocol.getOrderId() != null) {
            orderService.markLaboratoryResultReadyFromProtocol(protocol.getOrderId(), id);
        }
        auditService.log(id, ProtocolAuditAction.PUBLISHED_TO_CLIENT, protocol.getStatus(), protocol.getStatus(),
                userId, null);
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse cancel(Long id, Long userId) {
        return cancel(id, null, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse cancel(Long id, Long version, String reason, Long userId) {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.CANCELLED);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.CANCELLED);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.CANCELLED, old, protocol.getStatus(), userId,
                reason != null && !reason.isBlank() ? reason : null);
        return toResponse(protocol);
    }

    /** Soft-archive: CANCELLED/REPLACED -> ARCHIVED per the canonical workflow. Distinct from the
     *  hard delete() below, which only ever removes an empty DRAFT. */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse archive(Long id, Long userId) {
        return archive(id, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse archive(Long id, Long version, Long userId) {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.ARCHIVED);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.ARCHIVED);
        protocol.setDeletedAt(LocalDateTime.now());
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.ARCHIVED, old, protocol.getStatus(), userId, null);
        return toResponse(protocol);
    }

    /** Idempotent: any active protocol can be moved back to DRAFT, including one already there. */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnToDraft(Long id, Long userId) {
        return returnToDraft(id, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnToDraft(Long id, Long version, Long userId) {
        Protocol protocol = getOrThrow(id);
        if (protocol.getStatus() == ProtocolStatus.DRAFT) {
            return toResponse(protocol);
        }
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.DRAFT);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.DRAFT);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.UPDATED, old, ProtocolStatus.DRAFT, userId, "Возвращён в черновик");
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse attachMeasurementDevice(Long protocolId,
                                                                   ProtocolApiDtos.AttachMeasurementDeviceRequest request,
                                                                   Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, request.version());
        Long resolvedDeviceId = request.deviceId();
        if (resolvedDeviceId == null && request.id() != null && !request.id().isBlank()) {
            resolvedDeviceId = Long.parseLong(request.id());
        }
        if (resolvedDeviceId == null) {
            throw new BadRequestException("Укажите deviceId");
        }
        final Long deviceId = resolvedDeviceId;
        MeasurementDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new NotFoundException("Прибор не найден: " + deviceId));
        device.refreshStatus();
        if (device.getStatus() == MeasurementDeviceStatus.ARCHIVED) {
            throw new BadRequestException("Нельзя прикрепить архивный прибор");
        }
        List<ProtocolApiDtos.MeasurementDeviceData> instruments =
                new ArrayList<>(mapper.readInstruments(protocol.getInstrumentsJson()));
        ProtocolApiDtos.MeasurementDeviceData snapshot = mapper.toDevice(device);
        boolean exists = instruments.stream().anyMatch(i ->
                i.id() != null && i.id().equals(snapshot.id()));
        if (!exists) {
            instruments.add(snapshot);
        }
        mapper.writeInstruments(protocol, instruments);
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Прикреплён прибор: " + device.getName());
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse detachMeasurementDevice(Long protocolId, Long deviceId, Long userId) {
        return detachMeasurementDevice(protocolId, deviceId, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse detachMeasurementDevice(Long protocolId, Long deviceId, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        // The general instruments list must never diverge from what result rows actually use
        // (spec §14) - a device still referenced by a row can't be detached from "under" it.
        boolean stillInUse = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId).stream()
                .anyMatch(r -> deviceId.equals(r.getDeviceId()));
        if (stillInUse) {
            throw new ConflictException(
                    "Прибор используется в строках результатов. Сначала измените прибор в этих строках.",
                    "MEASUREMENT_DEVICE_IN_USE");
        }
        List<ProtocolApiDtos.MeasurementDeviceData> instruments =
                new ArrayList<>(mapper.readInstruments(protocol.getInstrumentsJson()));
        String deviceKey = String.valueOf(deviceId);
        instruments.removeIf(item -> deviceKey.equals(item.id()));
        mapper.writeInstruments(protocol, instruments);
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Удалён прибор: " + deviceId);
        return toResponse(protocol);
    }

    /** Keeps the protocol's general instruments list from ever diverging from what result rows
     *  actually use (spec §14: single source of truth is protocol_results.measurement_device_id)
     *  - any device a row references is guaranteed to also show up in the general list, without a
     *  separate manual attach step. */
    private void ensureInstrumentIncludesDevice(Protocol protocol, Long deviceId) {
        if (deviceId == null) {
            return;
        }
        List<ProtocolApiDtos.MeasurementDeviceData> instruments =
                new ArrayList<>(mapper.readInstruments(protocol.getInstrumentsJson()));
        String key = String.valueOf(deviceId);
        boolean exists = instruments.stream().anyMatch(i -> i.id() != null && i.id().equals(key));
        if (exists) {
            return;
        }
        deviceRepository.findById(deviceId).ifPresent(device -> instruments.add(mapper.toDevice(device)));
        mapper.writeInstruments(protocol, instruments);
    }

    private static void applyMeasurementDeviceFromBody(ProtocolResult result, Map<String, Object> body) {
        if (body == null) {
            return;
        }
        Object deviceRef = body.get("measurementDeviceId");
        if (deviceRef == null) {
            deviceRef = body.get("deviceId");
        }
        if (deviceRef == null && body.get("values") instanceof Map<?, ?> values) {
            deviceRef = values.get("measurementDeviceId");
            if (deviceRef == null) {
                deviceRef = values.get("deviceId");
            }
        }
        if (deviceRef == null) {
            return;
        }
        String device = String.valueOf(deviceRef).trim();
        if (device.isEmpty() || device.startsWith("local-") || "null".equalsIgnoreCase(device)) {
            return;
        }
        try {
            result.setDeviceId(Long.parseLong(device));
        } catch (NumberFormatException ignored) {
        }
    }

    @Transactional
    public Map<String, Object> addResult(Long protocolId, Map<String, Object> body, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, extractVersion(body));
        ProtocolTemplate template = template(protocol.getTemplateId());
        validateResultBody(body);
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocolId);
        result.setRowNumber(nextRowNumber(protocolId));
        ProtocolResultValuesMapper.applyValues(template.getCode(), result,
                ProtocolResultValuesMapper.fromRequestBody(body));
        applyMeasurementDeviceFromBody(result, body);
        validateMeasurementDevice(result);
        enrichNormative(protocol, template.getCode(), result);
        normativeCheckService.compareResult(result, new ArrayList<>());
        resultRepository.save(result);
        ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, "Добавлена строка");
        return ProtocolResultResponseMapper.toResponse(result);
    }

    @Transactional
    public Map<String, Object> addResult(Long protocolId, ProtocolApiDtos.ResultRow request, Long userId) {
        return addResult(protocolId, ProtocolResultValuesMapper.fromResultRow(request), userId);
    }

    @Transactional
    public Map<String, Object> updateResult(Long protocolId, Long resultId, Map<String, Object> body, Long userId) {
        ProtocolResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new NotFoundException("Строка не найдена: " + resultId));
        if (!result.getProtocolId().equals(protocolId)) {
            throw new NotFoundException("Строка не принадлежит протоколу: " + protocolId);
        }
        Protocol protocol = getEditableOrThrow(result.getProtocolId());
        checkVersion(protocol, extractVersion(body));
        ProtocolTemplate template = template(protocol.getTemplateId());
        ProtocolResultValuesMapper.applyValues(template.getCode(), result,
                ProtocolResultValuesMapper.fromRequestBody(body));
        applyMeasurementDeviceFromBody(result, body);
        validateMeasurementDevice(result);
        enrichNormative(protocol, template.getCode(), result);
        normativeCheckService.compareResult(result, new ArrayList<>());
        resultRepository.save(result);
        ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
        auditService.log(protocol.getId(), ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, "Обновлена строка");
        return ProtocolResultResponseMapper.toResponse(result);
    }

    /** Reads the optimistic-locking token out of a raw result-row body (addResult/updateResult
     *  take Map<String,Object>, not a typed record, so there's no request.version() to call) -
     *  accepts a JSON number OR a numeric string, same tolerance as applyMeasurementDeviceFromBody
     *  above. Never treated as a result field: see ProtocolResultValuesMapper.META_KEYS. */
    private static Long extractVersion(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        Object raw = body.get("version");
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    @Transactional
    public Map<String, Object> updateResult(Long protocolId, Long resultId, ProtocolApiDtos.ResultRow request, Long userId) {
        return updateResult(protocolId, resultId, ProtocolResultValuesMapper.fromResultRow(request), userId);
    }

    @Transactional
    public Map<String, Object> updateResult(Long resultId, ProtocolApiDtos.ResultRow request, Long userId) {
        ProtocolResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new NotFoundException("Строка не найдена: " + resultId));
        return updateResult(result.getProtocolId(), resultId, request, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse deleteResult(Long protocolId, Long resultId, Long userId) {
        return deleteResult(protocolId, resultId, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse deleteResult(Long protocolId, Long resultId, Long version, Long userId) {
        ProtocolResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new NotFoundException("Строка не найдена: " + resultId));
        if (!result.getProtocolId().equals(protocolId)) {
            throw new NotFoundException("Строка не принадлежит протоколу: " + protocolId);
        }
        Protocol protocol = getEditableOrThrow(result.getProtocolId());
        checkVersion(protocol, version);
        resultRepository.delete(result);
        auditService.log(result.getProtocolId(), ProtocolAuditAction.UPDATED, ProtocolStatus.DRAFT, ProtocolStatus.DRAFT, userId, "Удалена строка");
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse deleteResult(Long resultId, Long userId) {
        ProtocolResult result = resultRepository.findById(resultId)
                .orElseThrow(() -> new NotFoundException("Строка не найдена: " + resultId));
        return deleteResult(result.getProtocolId(), resultId, userId);
    }

    private void checkVersion(Protocol protocol, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(protocol.getVersion())) {
            throw new ConflictException("Протокол был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }
    }

    /** Loads every requested row and verifies each one belongs to this protocol before returning
     *  any of them - callers only ever get an all-or-nothing list, so a bulk operation either
     *  applies to every requested row or (via the surrounding @Transactional) none at all. */
    private List<ProtocolResult> loadOwnedResults(Long protocolId, List<Long> resultIds) {
        if (resultIds == null || resultIds.isEmpty()) {
            throw new BadRequestException("Укажите resultIds");
        }
        List<ProtocolResult> rows = resultRepository.findAllById(resultIds);
        if (rows.size() != resultIds.size()) {
            throw new NotFoundException("Некоторые строки результатов не найдены");
        }
        for (ProtocolResult r : rows) {
            if (!r.getProtocolId().equals(protocolId)) {
                throw new BadRequestException("Строка " + r.getId() + " не принадлежит протоколу " + protocolId);
            }
        }
        return rows;
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse bulkUpdateDevice(Long protocolId, List<Long> resultIds,
                                                             Long deviceId, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        if (deviceId == null) {
            throw new BadRequestException("Укажите measurementDeviceId");
        }
        List<ProtocolResult> rows = loadOwnedResults(protocolId, resultIds);
        MeasurementDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new NotFoundException("Прибор не найден: " + deviceId));
        device.refreshStatus();
        if (device.getStatus() == MeasurementDeviceStatus.ARCHIVED) {
            throw new BadRequestException("Нельзя использовать архивный прибор");
        }
        if (!device.isVerificationValid()) {
            throw new BadRequestException("Просрочена поверка прибора: " + device.getName());
        }
        for (ProtocolResult r : rows) {
            r.setDeviceId(device.getId());
            r.setVerificationDate(device.getVerificationDate());
            r.setVerificationValidUntil(device.getVerificationValidUntil());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(r, deviceSnapshot(device));
        }
        resultRepository.saveAll(rows);
        ensureInstrumentIncludesDevice(protocol, device.getId());
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовая смена прибора для строк: " + rows.size());
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse bulkUpdatePlace(Long protocolId, List<Long> resultIds,
                                                            String measurementPlace, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        if (isBlank(measurementPlace)) {
            throw new BadRequestException("Укажите measurementPlace");
        }
        List<ProtocolResult> rows = loadOwnedResults(protocolId, resultIds);
        for (ProtocolResult r : rows) {
            r.setSamplingPlace(measurementPlace.trim());
            r.setMeasurementPlace(measurementPlace.trim());
        }
        resultRepository.saveAll(rows);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовое изменение места отбора для строк: " + rows.size());
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse bulkDeleteResults(Long protocolId, List<Long> resultIds,
                                                              Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        List<ProtocolResult> rows = loadOwnedResults(protocolId, resultIds);
        resultRepository.deleteAll(rows);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовое удаление строк: " + rows.size());
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse checkNormatives(Long protocolId, Long userId) {
        return checkNormatives(protocolId, null, userId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse checkNormatives(Long protocolId, Long version, Long userId) {
        // Fixed hole (module spec §5): this used to load via plain getOrThrow with no editability
        // check at all, so re-running normative checks against a SIGNED/APPROVED/ARCHIVED protocol
        // would silently rewrite every ProtocolResult row's normative/min/max/comparisonType and
        // the protocol's complianceStatus - the exact "changing a signed protocol" class of bug
        // ProtocolMutationGuard exists to prevent everywhere else.
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        normativeCheckService.checkProtocol(protocolId, protocol.getObjectName(),
                protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
        protocol = getOrThrow(protocolId);
        if (protocol.getStatus() == ProtocolStatus.DRAFT) {
            protocol.setStatus(ProtocolStatus.CALCULATED);
            protocolRepository.save(protocol);
        }
        auditService.log(protocolId, ProtocolAuditAction.NORMATIVE_CHECK, protocol.getStatus(), protocol.getStatus(), userId, null);
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse refreshLaboratoryData(Long protocolId, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        Long laboratoryId = mapper.resolveLaboratoryIdFromSnapshot(protocol.getLaboratorySnapshot());
        Laboratory laboratory;
        if (laboratoryId != null) {
            laboratory = laboratoryService.getActiveByIdOrThrow(laboratoryId);
        } else {
            laboratory = laboratoryService.resolveDefaultLaboratoryOrThrow();
        }

        // The snapshot's executorId may predate the laboratory_employees.id contract and still
        // hold a users.id; findActiveEmployeeByUserId recovers the real employee so
        // applyLaboratoryFromEntity below re-writes the snapshot with the normalized id. Refreshing
        // laboratory data must never silently swap in a different executor (spec §6) - if the
        // previously-assigned executor can no longer be resolved, the caller must pick a new one
        // explicitly via PATCH rather than have one assigned for them.
        Long storedExecutorId = mapper.resolveExecutorIdFromSnapshot(protocol.getLaboratorySnapshot());
        LaboratoryEmployee employee = null;
        if (storedExecutorId != null) {
            employee = laboratoryService.findActiveEmployee(laboratory.getId(), storedExecutorId)
                    .or(() -> laboratoryService.findActiveEmployeeByUserId(laboratory.getId(), storedExecutorId))
                    .orElseThrow(() -> new ConflictException(
                            "Выбранный исполнитель больше не доступен. Выберите другого сотрудника.",
                            "PROTOCOL_EXECUTOR_UNAVAILABLE"));
        }

        mapper.applyLaboratoryFromEntity(protocol, laboratory, employee);
        protocol.setLaboratoryId(laboratory.getId());
        protocol.setExecutorId(employee != null ? employee.getId() : null);
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Обновлены данные лаборатории");
        return toResponse(protocol);
    }

    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.HistoryItem> audit(Long protocolId) {
        getOrThrow(protocolId);
        return mapper.toProtocol(getOrThrow(protocolId), template(getOrThrow(protocolId).getTemplateId()),
                resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId)).history();
    }

    public byte[] preview(Long protocolId) {
        return documentService.generatePreview(protocolId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse generateDocx(Long protocolId, Long userId) throws IOException {
        documentService.generateDocx(protocolId, userId);
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse generatePdf(Long protocolId, Long userId) throws IOException {
        documentService.generatePdf(protocolId, userId);
        return toResponse(getOrThrow(protocolId));
    }

    /** Falls back to an on-demand render when no stored file exists yet (e.g. right after an
     * edit cleared the stale docxFileId) so downloading never requires a separate generate step.
     * Once the protocol has actually been signed, the stored DOCX is part of the signed package
     * (module spec §6.3) and is served as-is, never silently re-rendered. */
    public StoredFileContent downloadDocx(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "docx");
        if (protocol.getDocxFileId() == null) {
            if (isSignedOrLater(protocol)) {
                throw new SignedDocumentIntegrityException(
                        "У подписанного протокола отсутствует сохранённый файл DOCX");
            }
            byte[] content = documentService.renderDocx(protocolId);
            return new StoredFileContent(protocol.getProtocolNumber() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    new java.io.ByteArrayInputStream(content));
        }
        return fileStorageService.load(protocol.getDocxFileId());
    }

    /** See {@link #downloadDocx}: renders on demand when no stored PDF exists yet. Once signed,
     * this is the actual cryptographically-signed artifact (module spec §6) - its bytes are
     * re-hashed against the sha256 recorded at signing time before being served, and any mismatch
     * or missing file is a hard integrity error, never a silent re-render (§6.6-§6.8). */
    public StoredFileContent downloadPdf(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "pdf");
        if (protocol.getPdfFileId() == null) {
            if (isSignedOrLater(protocol)) {
                throw new SignedDocumentIntegrityException(
                        "У подписанного протокола отсутствует сохранённый файл PDF");
            }
            byte[] content = documentService.renderPdf(protocolId);
            return new StoredFileContent(protocol.getProtocolNumber() + ".pdf", "application/pdf",
                    new java.io.ByteArrayInputStream(content));
        }
        StoredFileContent stored = fileStorageService.load(protocol.getPdfFileId());
        if (protocol.getPdfSha256() == null) {
            return stored;
        }
        byte[] bytes;
        try (var in = stored.inputStream()) {
            bytes = in.readAllBytes();
        }
        if (!protocol.getPdfSha256().equals(sha256Hex(bytes))) {
            throw new SignedDocumentIntegrityException(
                    "Сохранённый PDF не соответствует hash, зафиксированному при подписании");
        }
        return new StoredFileContent(stored.filename(), stored.contentType(), new java.io.ByteArrayInputStream(bytes));
    }

    /** Renders straight from the real template on demand; does not require a prior generate-docx
     * call. Forbidden once signed (module spec §6.7 "не выполнять on-demand render подписанного
     * PDF" - extended here to DOCX too, since it is part of the same signed snapshot/package). */
    public StoredFileContent downloadDocxRendered(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_DOCX);
        byte[] content = documentService.renderDocx(protocolId);
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "docx");
        return new StoredFileContent(protocol.getProtocolNumber() + ".docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new java.io.ByteArrayInputStream(content));
    }

    /** Renders straight from the real template (via DOCX -> PDF) on demand. Forbidden once signed -
     *  see {@link #downloadDocxRendered}; a signed protocol must be downloaded via {@link #downloadPdf}
     *  (the actual signed artifact), never re-rendered from current data. */
    public StoredFileContent downloadPdfRendered(Long protocolId, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_PDF);
        byte[] content = documentService.renderPdf(protocolId);
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "pdf");
        return new StoredFileContent(protocol.getProtocolNumber() + ".pdf", "application/pdf",
                new java.io.ByteArrayInputStream(content));
    }

    private static boolean isSignedOrLater(Protocol protocol) {
        return protocol.getStatus() == ProtocolStatus.SIGNED || protocol.getStatus() == ProtocolStatus.REPLACED
                || protocol.getStatus() == ProtocolStatus.CANCELLED || protocol.getStatus() == ProtocolStatus.ARCHIVED;
    }

    private void syncResults(Protocol protocol, String templateCode, List<ProtocolApiDtos.ResultRow> rows) {
        List<ProtocolResult> existing = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        Set<Long> updatedIds = new java.util.HashSet<>();
        int rowNumber = 1;

        for (ProtocolApiDtos.ResultRow row : rows) {
            ProtocolResult result;
            Long rowId = row.id() != null ? parseLongSafe(row.id()) : null;
            if (rowId != null) {
                result = existing.stream().filter(r -> r.getId().equals(rowId)).findFirst().orElse(null);
                if (result != null) {
                    updatedIds.add(result.getId());
                } else {
                    result = new ProtocolResult();
                    result.setProtocolId(protocol.getId());
                }
            } else {
                result = new ProtocolResult();
                result.setProtocolId(protocol.getId());
            }
            result.setRowNumber(rowNumber++);
            ProtocolResultValuesMapper.applyValues(templateCode, result,
                    ProtocolResultValuesMapper.fromResultRow(row));
            enrichNormative(protocol, templateCode, result);
            normativeCheckService.compareResult(result, new ArrayList<>());
            resultRepository.save(result);
            ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
            updatedIds.add(result.getId());
        }

        for (ProtocolResult old : existing) {
            if (!updatedIds.contains(old.getId())) {
                resultRepository.delete(old);
            }
        }
    }

    private static Long parseLongSafe(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Long.parseLong(value); }
        catch (NumberFormatException e) { return null; }
    }

    private Protocol cloneProtocol(Protocol old, ProtocolTemplate template, Long userId, Long replacedId, String reason) {
        Protocol copy = new Protocol();
        copy.setTemplateId(old.getTemplateId());
        copy.setProtocolDate(old.getProtocolDate());
        copy.setTotalPages(old.getTotalPages());
        copy.setLaboratoryName(old.getLaboratoryName());
        copy.setLaboratoryAddress(old.getLaboratoryAddress());
        copy.setLaboratoryLogoFileId(old.getLaboratoryLogoFileId());
        copy.setAccreditationNumber(old.getAccreditationNumber());
        copy.setAccreditationValidFrom(old.getAccreditationValidFrom());
        copy.setAccreditationValidUntil(old.getAccreditationValidUntil());
        copy.setDirectorName(old.getDirectorName());
        copy.setHeadOfLaboratoryName(old.getHeadOfLaboratoryName());
        copy.setExecutorName(old.getExecutorName());
        copy.setOrganizationName(old.getOrganizationName());
        copy.setOrganizationAddress(old.getOrganizationAddress());
        copy.setProductName(old.getProductName());
        copy.setObjectName(old.getObjectName());
        copy.setBasisForTesting(old.getBasisForTesting());
        copy.setProductNd(old.getProductNd());
        copy.setSamplingMethodNd(old.getSamplingMethodNd());
        copy.setTestingMethodNd(old.getTestingMethodNd());
        copy.setSampleDate(old.getSampleDate());
        copy.setTestDate(old.getTestDate());
        copy.setTestPurpose(old.getTestPurpose());
        copy.setEnvironmentConditions(old.getEnvironmentConditions());
        copy.setCompanyId(old.getCompanyId());
        copy.setCompanyNameSnapshot(old.getCompanyNameSnapshot());
        copy.setCompanyBinSnapshot(old.getCompanyBinSnapshot());
        copy.setCompanyLegalAddressSnapshot(old.getCompanyLegalAddressSnapshot());
        copy.setCompanyActualAddressSnapshot(old.getCompanyActualAddressSnapshot());
        copy.setCompanyPhoneSnapshot(old.getCompanyPhoneSnapshot());
        copy.setCompanyEmailSnapshot(old.getCompanyEmailSnapshot());
        copy.setCompanyDirectorNameSnapshot(old.getCompanyDirectorNameSnapshot());
        copy.setCompanyDirectorPositionSnapshot(old.getCompanyDirectorPositionSnapshot());
        copy.setCompanyResponsiblePersonSnapshot(old.getCompanyResponsiblePersonSnapshot());
        copy.setCompanyResponsiblePersonPhoneSnapshot(old.getCompanyResponsiblePersonPhoneSnapshot());
        copy.setCompanyBankNameSnapshot(old.getCompanyBankNameSnapshot());
        copy.setCompanyIbanSnapshot(old.getCompanyIbanSnapshot());
        copy.setCompanyBikSnapshot(old.getCompanyBikSnapshot());
        copy.setCompanyKbeSnapshot(old.getCompanyKbeSnapshot());
        copy.setCompanyKnpSnapshot(old.getCompanyKnpSnapshot());
        copy.setCompanyContractNumberSnapshot(old.getCompanyContractNumberSnapshot());
        copy.setCompanyContractDateSnapshot(old.getCompanyContractDateSnapshot());
        copy.setObjectAddressSnapshot(old.getObjectAddressSnapshot());
        copy.setActivityTypeSnapshot(old.getActivityTypeSnapshot());
        copy.setSamplingLocationSnapshot(old.getSamplingLocationSnapshot());
        copy.setCustomerRepresentativeSnapshot(old.getCustomerRepresentativeSnapshot());
        copy.setPrintVisibilityJson(old.getPrintVisibilityJson());
        copy.setProtocolNumber(numberGenerator.generate(template, old.getProtocolDate()));
        copy.setStatus(ProtocolStatus.DRAFT);
        copy.setCreatedBy(userId);
        copy.setReplacedProtocolId(replacedId);
        copy.setReplacementReason(reason);
        return copy;
    }

    private void enrichNormative(Protocol protocol, String templateCode, ProtocolResult result) {
        String normalizedCode = templateCode != null ? templateCode.trim().toLowerCase() : null;
        normativeCheckService.applyNormativeToResult(
                result, normalizedCode, protocol.getObjectName(),
                protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
    }

    private void validateReadyForApproval(Protocol protocol) {
        if (isBlank(protocol.getProtocolNumber())) throw new BadRequestException("Заполните номер протокола");
        if (protocol.getProtocolDate() == null) throw new BadRequestException("Заполните дату протокола");
        if (isBlank(protocol.getOrganizationName())) throw new BadRequestException("Заполните организацию");
        if (isBlank(protocol.getObjectName())) throw new BadRequestException("Заполните объект");
        if (protocol.getSampleDate() == null) throw new BadRequestException("Заполните дату отбора");
        if (protocol.getTestDate() == null) throw new BadRequestException("Заполните дату испытаний");
        if (isBlank(protocol.getTestingMethodNd())) throw new BadRequestException("Укажите НД на методы испытаний");
        if (isBlank(protocol.getExecutorName())) throw new BadRequestException("Укажите исполнителя");
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        if (results.isEmpty()) throw new BadRequestException("Добавьте хотя бы одну строку результата");
        for (ProtocolResult r : results) {
            if (normativeCheckService.resolveComparableValue(r) == null) {
                throw new BadRequestException("Строка " + r.getRowNumber() + ": нет значения результата");
            }
            if ("WAITING_INPUTS".equals(r.getCalculationStatus())) {
                throw new BadRequestException("Строка " + r.getRowNumber() + ": не заполнены исходные данные");
            }
            if ("ERROR".equals(r.getCalculationStatus())) {
                throw new BadRequestException("Строка " + r.getRowNumber() + ": ошибка расчёта");
            }
            if ("NEEDS_REPEAT".equals(r.getCalculationStatus())) {
                throw new BadRequestException("Строка " + r.getRowNumber() + ": требуется повторный анализ");
            }
        }
    }

    private void validateBeforeApprove(Protocol protocol) {
        validateReadyForApproval(protocol);
        if (isBlank(protocol.getHeadOfLaboratoryName()) && isBlank(protocol.getDirectorName())) {
            throw new BadRequestException("Укажите утверждающего (руководитель лаборатории или директор)");
        }
    }

    private void validateBeforeSign(Protocol protocol) {
        validateBeforeApprove(protocol);
        for (ProtocolResult r : resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId())) {
            if (r.getDeviceId() == null) continue;
            MeasurementDevice device = deviceRepository.findById(r.getDeviceId())
                    .orElseThrow(() -> new BadRequestException("Прибор не найден: " + r.getDeviceId()));
            device.refreshStatus();
            if (!device.isVerificationValid()) {
                throw new BadRequestException("Просрочена поверка прибора: " + device.getName());
            }
        }
    }

    private ProtocolApiDtos.ProtocolResponse toResponse(Protocol protocol) {
        ProtocolTemplate template = template(protocol.getTemplateId());
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        ProtocolEnvironmentConditions env = envConditionsRepository.findByProtocolId(protocol.getId()).orElse(null);
        return mapper.toProtocol(protocol, template, results, env);
    }

    private ProtocolTemplate resolveTemplate(String templateId, String subtype) {
        ProtocolTemplateCode code = ProtocolTemplateCode.fromCode(templateId, subtype);
        return templateRepository.findByCode(code.name())
                .orElseThrow(() -> new NotFoundException("Шаблон не найден: " + templateId));
    }

    private ProtocolTemplate template(Long templateId) {
        return templateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Шаблон не найден: " + templateId));
    }

    private Protocol getOrThrow(Long id) {
        return protocolRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Протокол не найден: " + id));
    }

    /** Only DRAFT/CALCULATED/READY/NEEDS_REVISION are editable - APPROVED/SIGNED/REPLACED/
     *  CANCELLED/ARCHIVED are frozen (header, company, object, laboratory, executor, results,
     *  normatives, devices, environment, files, number, date, signatures - everything). */
    private Protocol getEditableOrThrow(Long id) {
        Protocol protocol = getOrThrow(id);
        if (protocol.getDeletedAt() != null || !protocol.getStatus().isEditable()) {
            throw new ConflictException(
                    "Протокол со статусом " + protocol.getStatus() + " недоступен для изменения",
                    "PROTOCOL_IMMUTABLE");
        }
        return protocol;
    }

    private void validateQuickCreateRequest(ProtocolApiDtos.QuickCreateProtocolRequest request) {
        if (request == null || isBlank(request.templateId())) {
            throw new BadRequestException("Укажите templateId");
        }
        ProtocolTypeConfig typeConfig = ProtocolTypeRegistry.require(request.templateId(), request.subtype());
        ProtocolTypeRegistry.validateConsistency(typeConfig, request.sourceDocumentCode(), request.docxTemplateCode());
        if (!typeConfig.active()) {
            throw new BadRequestException(
                    "Тип протокола временно недоступен: отсутствует шаблон печати " + typeConfig.docxTemplateCode());
        }
        if (request.companyId() == null) {
            throw new BadRequestException("Укажите companyId");
        }
        if (request.objectId() == null) {
            throw new BadRequestException("Укажите objectId");
        }
        if (isBlank(request.protocolDate())) {
            throw new BadRequestException("Укажите protocolDate");
        }
        if (isBlank(request.measurementDate())) {
            throw new BadRequestException("Укажите measurementDate");
        }
        if (request.laboratoryId() == null) {
            throw new BadRequestException("Укажите laboratoryId");
        }
        if (request.executorId() == null) {
            throw new BadRequestException("Укажите executorId");
        }
        if (!isBlank(request.testingStartDate()) && !isBlank(request.testingEndDate())) {
            LocalDate start = ProtocolApiMapper.parseDate(request.testingStartDate());
            LocalDate end = ProtocolApiMapper.parseDate(request.testingEndDate());
            if (start != null && end != null && end.isBefore(start)) {
                throw new BadRequestException("testingEndDate не может быть раньше testingStartDate");
            }
        }
        if (request.measurements() == null || request.measurements().isEmpty()) {
            throw new BadRequestException("Укажите measurements");
        }
        boolean physical = typeConfig.resultMode() == ProtocolTypeConfig.ResultMode.PHYSICAL;
        for (int i = 0; i < request.measurements().size(); i++) {
            ProtocolApiDtos.QuickCreateMeasurement m = request.measurements().get(i);
            if (isBlank(m.indicatorName())) {
                throw new BadRequestException("Строка " + (i + 1) + ": укажите indicatorName");
            }
            if (m.value() == null) {
                throw new BadRequestException("Строка " + (i + 1) + ": укажите value");
            }
            String unit = ProtocolUnitResolver.resolve(m.unit(), typeConfig, m.factorCode());
            if (isBlank(unit)) {
                throw new BadRequestException("Укажите единицу измерения для: " + m.indicatorName());
            }
            if (physical) {
                // factorCode is deliberately NOT required here, matching
                // NormativeApiContract.isClassified: not every DSM-15 table row carries its own
                // code (many are keyed by factorType + condition columns only), so requiring it
                // unconditionally rejected otherwise-valid rows. A row that genuinely needs a
                // factorCode to disambiguate will still surface as an ambiguous/not-found match at
                // normative-resolution time instead of being blocked at input validation.
                if (isBlank(m.factorType())) {
                    throw new BadRequestException("Строка " + (i + 1) + ": укажите factorType");
                }
            } else if (isBlank(m.pollutantCode())) {
                throw new BadRequestException("Строка " + (i + 1) + ": укажите pollutantCode");
            }
        }
        validateAgainstTypePolicy(request);
    }

    /**
     * Type-specific checks (soil sample location, water category, microclimate/lighting/noise
     * condition fields, etc.) via {@link ProtocolValidationPolicy} - unlike the structural checks
     * above (which fail fast since later checks depend on their preconditions), these are fully
     * aggregated into one response so the client sees every missing field at once (spec §8).
     */
    private void validateAgainstTypePolicy(ProtocolApiDtos.QuickCreateProtocolRequest request) {
        ProtocolValidationPolicy policy = validationPolicyRegistry.resolve(request.templateId());
        ProtocolValidationContext context = new ProtocolValidationContext(
                request.companyId(), request.objectId(), request.laboratoryId(), request.executorId(),
                request.protocolDate(), request.measurementDate(), null, null, request.measurementPlace(),
                toConditionsMap(request.conditions()));
        List<ProtocolValidationError> errors = new ArrayList<>(policy.validateHeader(context));
        List<ProtocolApiDtos.QuickCreateMeasurement> measurements = request.measurements();
        for (int i = 0; i < measurements.size(); i++) {
            ProtocolApiDtos.QuickCreateMeasurement m = measurements.get(i);
            errors.addAll(policy.validateMeasurement(i, context, new MeasurementInput(
                    m.factorType(), m.factorCode(), m.pollutantCode(), m.indicatorName(),
                    m.value(), m.unit(), m.normativeId(), resolveMeasurementDeviceId(m))));
        }
        if (!errors.isEmpty()) {
            List<ApiFieldError> details = errors.stream()
                    .map(e -> new ApiFieldError(e.field(), e.code(), e.message()))
                    .toList();
            throw new ValidationException("Протокол заполнен не полностью", details);
        }
    }

    private static Map<String, Object> toConditionsMap(ProtocolApiDtos.QuickCreateConditions c) {
        if (c == null) {
            return Map.of();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        putIfPresent(map, "season", c.season());
        putIfPresent(map, "workCategory", c.workCategory());
        putIfPresent(map, "workplaceType", c.workplaceType());
        putIfPresent(map, "roomType", c.roomType());
        putIfPresent(map, "normLevel", c.normLevel());
        putIfPresent(map, "sampleNumber", c.sampleNumber());
        putIfPresent(map, "samplingDepth", c.samplingDepth());
        putIfPresent(map, "samplingPlace", c.samplingPlace());
        putIfPresent(map, "lightingType", c.lightingType());
        putIfPresent(map, "noiseType", c.noiseType());
        putIfPresent(map, "visualWorkCategory", c.visualWorkCategory());
        putIfPresent(map, "waterType", c.waterType());
        putIfPresent(map, "waterUseCategory", c.waterUseCategory());
        return map;
    }

    private void addQuickCreateMeasurement(Protocol protocol,
                                           ProtocolTemplate template,
                                           ProtocolApiDtos.QuickCreateProtocolRequest request,
                                           ProtocolApiDtos.QuickCreateMeasurement measurement,
                                           ProtocolTypeConfig typeConfig,
                                           LocalDate onDate) {
        boolean physical = typeConfig.resultMode() == ProtocolTypeConfig.ResultMode.PHYSICAL;
        String unit = ProtocolUnitResolver.resolve(measurement.unit(), typeConfig, measurement.factorCode());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("indicatorName", measurement.indicatorName());
        body.put("indicator", measurement.indicatorName());
        body.put("unit", unit);
        body.put("result", measurement.value());
        body.put("primaryReading", measurement.value());
        body.put("resultValue", measurement.value());
        putIfPresent(body, "testingMethodDocument", measurement.testingMethodNd());
        putIfPresent(body, "samplingMethodDocument", measurement.samplingMethodNd());
        if (physical) {
            body.put("factorType", measurement.factorType());
            body.put("factorCode", measurement.factorCode());
            body.put("subtype", firstNonBlank(measurement.factorType(), request.subtype()));
        } else {
            body.put("pollutantCode", measurement.pollutantCode());
            body.put("code", measurement.pollutantCode());
        }
        if (request.measurementPlace() != null) {
            body.put("measurementPlace", request.measurementPlace());
            body.put("samplingPlace", request.measurementPlace());
        }
        if (request.conditions() != null) {
            putIfPresent(body, "season", request.conditions().season());
            putIfPresent(body, "workCategory", request.conditions().workCategory());
            putIfPresent(body, "workplaceType", request.conditions().workplaceType());
            putIfPresent(body, "roomType", request.conditions().roomType());
            putIfPresent(body, "normLevel", request.conditions().normLevel());
            // sampleNumber maps onto the existing sampleName column (e.g. "Проба №1"); samplingDepth
            // has no dedicated column yet and is kept as an extra value in values_json. Both are
            // applied after measurementPlace so an explicit samplingPlace can override it.
            putIfPresent(body, "sampleName", request.conditions().sampleNumber());
            putIfPresent(body, "samplingDepth", request.conditions().samplingDepth());
            putIfPresent(body, "samplingPlace", request.conditions().samplingPlace());
            putIfPresent(body, "lightingType", request.conditions().lightingType());
            putIfPresent(body, "noiseType", request.conditions().noiseType());
            putIfPresent(body, "visualWorkCategory", request.conditions().visualWorkCategory());
            putIfPresent(body, "waterType", request.conditions().waterType());
            putIfPresent(body, "waterUseCategory", request.conditions().waterUseCategory());
        }
        // Extra raw fields the frontend collected for this measurement (e.g. factor-specific
        // inputs not covered by the named fields above) are merged in last so they can supply
        // anything missing without requiring a DTO change for every new factor.
        if (measurement.values() != null) {
            body.putAll(measurement.values());
        }

        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocol.getId());
        result.setRowNumber(nextRowNumber(protocol.getId()));
        ProtocolResultValuesMapper.applyValues(template.getCode(), result,
                ProtocolResultValuesMapper.fromRequestBody(body));

        ProtocolNormativeCheckService.NormativeResolution normative = normativeCheckService.resolveForQuickCreate(
                request.templateId(), measurement, request.conditions(), onDate);
        if (normative.found()) {
            NormativeSnapshotHelper.applySnapshotToResult(result, normative.normative());
            normativeCheckService.compareResult(result, new ArrayList<>());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of("normativeSearchStatus", "MATCHED"));
        } else if (!isBlank(measurement.normativeValue())) {
            // Client already resolved/selected the normative on its side (normativeId/normativeValue
            // supplied); trust it rather than blocking on our own lookup missing/being ambiguous.
            applyManualNormative(result, measurement);
            normativeCheckService.compareResult(result, new ArrayList<>());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of("normativeSearchStatus", "MANUAL"));
        } else if (normative.warning() != null) {
            // Several equally-plausible normatives matched (e.g. same pollutant code across
            // different water types) - saving one at random would be worse than saving none, so
            // the row is left without a normativeId and the ambiguity is surfaced instead.
            result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of(
                    "normativeSearchStatus", "AMBIGUOUS",
                    "normativeSearchWarning", normative.warning(),
                    "normativeWarning", normative.warning()
            ));
        } else {
            result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
            String label = physical
                    ? firstNonBlank(measurement.factorCode(), measurement.indicatorName())
                    : firstNonBlank(measurement.pollutantCode(), measurement.indicatorName());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of(
                    "normativeSearchStatus", "NOT_FOUND",
                    "normativeWarning", "Норматив не найден для: " + label
            ));
        }
        applyMeasurementDeviceForQuickCreate(result, measurement, onDate);
        resultRepository.save(result);
        ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
    }

    /**
     * Resolves the device for a quick-create measurement row (measurementDeviceId -> deviceId ->
     * values.measurementDeviceId -> values.deviceId), validates it, and - unlike the softer
     * validateMeasurementDevice used by addResult/updateResult, which only flags NEEDS_REVIEW -
     * hard-fails with 400 on an archived device or a verification that had already expired on the
     * measurement date, per the quick-create contract. On success the device's name/model/serial/
     * verification are snapshotted into the result's valuesJson (deviceSnapshot) so a later edit
     * to the device catalog can never retroactively change what an already-issued protocol says.
     */
    private void applyMeasurementDeviceForQuickCreate(ProtocolResult result,
                                                       ProtocolApiDtos.QuickCreateMeasurement measurement,
                                                       LocalDate onDate) {
        Long deviceId = resolveMeasurementDeviceId(measurement);
        if (deviceId == null) {
            return;
        }
        MeasurementDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new BadRequestException("Строка " + result.getRowNumber()
                        + ": прибор не найден: " + deviceId));
        device.refreshStatus();
        if (device.getStatus() == MeasurementDeviceStatus.ARCHIVED) {
            throw new BadRequestException("Нельзя использовать выбранный прибор: " + device.getName()
                    + (device.getSerialNumber() != null ? ", зав. №" + device.getSerialNumber() : "")
                    + ": прибор архивирован");
        }
        if (device.getVerificationValidUntil() != null && onDate != null
                && device.getVerificationValidUntil().isBefore(onDate)) {
            throw new BadRequestException("Нельзя использовать выбранный прибор: " + device.getName()
                    + (device.getSerialNumber() != null ? ", зав. №" + device.getSerialNumber() : "")
                    + ": срок поверки истёк " + device.getVerificationValidUntil().format(DATE_FMT));
        }
        result.setDeviceId(device.getId());
        result.setVerificationDate(device.getVerificationDate());
        result.setVerificationValidUntil(device.getVerificationValidUntil());
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, deviceSnapshot(device));
    }

    /**
     * Snapshot of a device's identifying details (name/model/serial/verification) frozen into
     * ProtocolResult.valuesJson at the moment it's attached to a row - so editing the device
     * catalog later never retroactively changes what an already-issued protocol reports.
     */
    private static Map<String, Object> deviceSnapshot(MeasurementDevice device) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("measurementDeviceName", device.getName());
        snapshot.put("measurementDeviceModel", device.getModel());
        snapshot.put("measurementDeviceSerialNumber", device.getSerialNumber());
        snapshot.put("measurementDeviceVerificationNumber", device.getVerificationCertificateNumber());
        if (device.getVerificationValidUntil() != null) {
            snapshot.put("measurementDeviceVerificationValidUntil", device.getVerificationValidUntil().toString());
        }
        return snapshot;
    }

    private Long resolveMeasurementDeviceId(ProtocolApiDtos.QuickCreateMeasurement measurement) {
        if (measurement.measurementDeviceId() != null) {
            return measurement.measurementDeviceId();
        }
        if (measurement.deviceId() != null) {
            return measurement.deviceId();
        }
        Map<String, Object> values = measurement.values();
        if (values == null) {
            return null;
        }
        Long fromValues = toLongOrNull(values.get("measurementDeviceId"));
        if (fromValues != null) {
            return fromValues;
        }
        return toLongOrNull(values.get("deviceId"));
    }

    private static Long toLongOrNull(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Long value) {
            return value;
        }
        if (raw instanceof Number number) {
            return number.longValue();
        }
        String text = String.valueOf(raw).trim();
        if (text.isEmpty() || text.startsWith("local-") || "null".equalsIgnoreCase(text)) {
            return null;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ex) {
            try {
                return new BigDecimal(text).longValueExact();
            } catch (Exception ex2) {
                return null;
            }
        }
    }

    private void applyManualNormative(ProtocolResult result, ProtocolApiDtos.QuickCreateMeasurement measurement) {
        try {
            java.math.BigDecimal value = new java.math.BigDecimal(measurement.normativeValue().trim().replace(',', '.'));
            result.setNormativeValue(value);
            result.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        } catch (NumberFormatException ignored) {
            // e.g. a range like "22-24": stored as a raw snapshot value only, comparison skipped.
        }
        if (!isBlank(measurement.normativeId())) {
            try {
                result.setNormativeId(Long.parseLong(measurement.normativeId().trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of(
                "value", measurement.normativeValue()
        ));
    }

    private static void putIfPresent(Map<String, Object> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private void writeCompanySnapshotJson(Protocol protocol, Company company) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("id", company.getId());
            snapshot.put("name", company.getName());
            snapshot.put("bin", company.getBin());
            snapshot.put("legalAddress", company.getLegalAddress());
            snapshot.put("actualAddress", company.getActualAddress());
            snapshot.put("phone", company.getPhone());
            snapshot.put("email", company.getEmail());
            snapshot.put("directorName", company.getDirectorName());
            snapshot.put("directorPosition", company.getDirectorPosition());
            snapshot.put("objectName", company.getObjectName());
            snapshot.put("objectAddress", company.getObjectAddress());
            protocol.setCompanySnapshot(objectMapper.writeValueAsString(snapshot));
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось сохранить snapshot компании", ex);
        }
    }

    private void validateCreateRequest(ProtocolApiDtos.CreateProtocolRequest request) {
        if (request == null || isBlank(request.templateId())) {
            throw new BadRequestException("Укажите templateId");
        }
        if (request.companyId() == null) {
            throw new BadRequestException("Укажите companyId");
        }
        if (request.objectId() == null) {
            throw new BadRequestException("Укажите objectId");
        }
        if (isBlank(request.protocolDate())) {
            throw new BadRequestException("Укажите protocolDate");
        }
        if (isBlank(firstNonBlank(request.sampleDate(), request.samplingDate(), request.measurementDate()))) {
            throw new BadRequestException("Укажите дату отбора/замера");
        }
        if (isBlank(request.testingStartDate())) {
            throw new BadRequestException("Укажите testingStartDate");
        }
    }

    private void validateResultBody(Map<String, Object> body) {
        if (body == null || body.isEmpty()) {
            throw new BadRequestException("Пустое тело запроса результата");
        }
        Map<String, Object> values = ProtocolResultValuesMapper.fromRequestBody(body);
        String indicator = firstNonBlank(stringValue(values.get("indicatorName")), stringValue(values.get("indicator")));
        if (indicator == null || indicator.isBlank()) {
            throw new BadRequestException("Укажите indicatorName");
        }
        String unit = stringValue(values.get("unit"));
        if (unit == null || unit.isBlank()) {
            throw new BadRequestException("Укажите unit");
        }
        boolean hasResult = values.get("result") != null || values.get("primaryReading") != null
                || values.get("resultValue") != null;
        if (!hasResult) {
            throw new BadRequestException("Укажите result или primaryReading");
        }
    }

    private void validateMeasurementDevice(ProtocolResult result) {
        if (result.getDeviceId() == null) {
            return;
        }
        MeasurementDevice device = deviceRepository.findById(result.getDeviceId())
                .orElseThrow(() -> new BadRequestException("Прибор не найден: " + result.getDeviceId()));
        device.refreshStatus();
        if (device.getStatus() == MeasurementDeviceStatus.ARCHIVED) {
            throw new BadRequestException("Нельзя использовать архивный прибор");
        }
        if (!device.isVerificationValid()) {
            result.setInternalStatus(ResultInternalStatus.NEEDS_REVIEW);
            ProtocolResultValuesMapper.setExtraFlag(result, "deviceWarning", "Просрочена поверка прибора");
        }
        result.setVerificationDate(device.getVerificationDate());
        result.setVerificationValidUntil(device.getVerificationValidUntil());
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, deviceSnapshot(device));
    }

    private static String stringValue(Object value) {
        return value != null ? String.valueOf(value).trim() : null;
    }

    private int nextRowNumber(Long protocolId) {
        return resultRepository.findTopByProtocolIdOrderByRowNumberDesc(protocolId)
                .map(r -> r.getRowNumber() + 1).orElse(1);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trim(String value) {
        return value != null ? value.trim() : null;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private void saveEnvironmentConditions(Long protocolId, ProtocolApiDtos.EnvironmentData env) {
        ProtocolEnvironmentConditions conditions = envConditionsRepository
                .findByProtocolId(protocolId).orElse(new ProtocolEnvironmentConditions());
        conditions.setProtocolId(protocolId);
        conditions.setTemperatureC(env.temperatureC());
        conditions.setTemperatureMinC(env.temperatureMinC());
        conditions.setTemperatureMaxC(env.temperatureMaxC());
        conditions.setHumidityPercent(env.humidityPercent());
        conditions.setHumidityMinPercent(env.humidityMinPercent());
        conditions.setHumidityMaxPercent(env.humidityMaxPercent());
        conditions.setWindSpeedMs(env.windSpeedMs());
        conditions.setConditionsComment(env.conditionsComment());
        conditions.setSource(env.source());
        conditions.setDataSource(env.dataSource());
        conditions.setManualChangeReason(env.manualChangeReason());
        conditions.setWeatherObservedAt(parseOffsetDateTime(env.observedAt()));
        BigDecimal pressure = env.pressureKpa();
        if (pressure == null && env.pressureHpa() != null) {
            pressure = env.pressureHpa().divide(BigDecimal.TEN, 12, java.math.RoundingMode.UNNECESSARY);
        }
        conditions.setPressureKpa(pressure);
        envConditionsRepository.save(conditions);
    }

    private static java.time.OffsetDateTime parseOffsetDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return java.time.OffsetDateTime.parse(value.trim());
        } catch (java.time.format.DateTimeParseException ex) {
            try {
                return LocalDateTime.parse(value.trim()).atOffset(java.time.ZoneOffset.UTC);
            } catch (java.time.format.DateTimeParseException ex2) {
                return null;
            }
        }
    }

    void copyCompanySnapshotToProtocol(Company company, Protocol protocol) {
        protocol.setCompanyId(company.getId());
        protocol.setCompanyNameSnapshot(company.getName());
        protocol.setCompanyBinSnapshot(company.getBin());
        protocol.setCompanyLegalAddressSnapshot(company.getLegalAddress());
        protocol.setCompanyActualAddressSnapshot(company.getActualAddress());
        protocol.setCompanyPhoneSnapshot(company.getPhone());
        protocol.setCompanyEmailSnapshot(company.getEmail());
        protocol.setCompanyDirectorNameSnapshot(company.getDirectorName());
        protocol.setCompanyDirectorPositionSnapshot(company.getDirectorPosition());
        protocol.setCompanyResponsiblePersonSnapshot(company.getResponsiblePerson());
        protocol.setCompanyResponsiblePersonPhoneSnapshot(company.getResponsiblePersonPhone());
        protocol.setCompanyBankNameSnapshot(company.getBankName());
        protocol.setCompanyIbanSnapshot(company.getIban());
        protocol.setCompanyBikSnapshot(company.getBik());
        protocol.setCompanyKbeSnapshot(company.getKbe());
        protocol.setCompanyKnpSnapshot(company.getKnp());
        protocol.setCompanyContractNumberSnapshot(company.getContractNumber());
        protocol.setCompanyContractDateSnapshot(company.getContractDate());
        protocol.setObjectNameSnapshot(company.getObjectName());
        protocol.setObjectAddressSnapshot(company.getObjectAddress());
        protocol.setActivityTypeSnapshot(company.getActivityType());
        protocol.setSamplingLocationSnapshot(company.getSamplingLocation());
        protocol.setCustomerRepresentativeSnapshot(company.getCustomerRepresentative());
    }

    /**
     * Companies created the old way never got a row in company_objects — their "object" only
     * ever existed as objectName/objectAddress/... columns on the company itself. objectId is
     * allowed to reference either a real CompanyObject or, as a fallback, the company itself
     * (objectId == companyId), so those companies can still get protocols without a migration.
     */
    private void applyObjectFromRequest(Protocol protocol, Company company, ProtocolApiDtos.CreateProtocolRequest request) {
        if (request.objectId() == null) {
            if (request.measurementPlace() != null && !request.measurementPlace().isBlank()) {
                protocol.setSamplingLocationSnapshot(trim(request.measurementPlace()));
            }
            if (request.sourceNumber() != null && !request.sourceNumber().isBlank()) {
                writeObjectSnapshot(protocol, null, trim(request.sourceNumber()));
            }
            return;
        }

        Optional<CompanyObject> found = companyObjectRepository.findById(request.objectId());
        // A CompanyObject row belonging to the requested company always wins. Only after ruling
        // that out do we consider the objectId==companyId fallback below - otherwise an unrelated
        // CompanyObject that happens to share its numeric id with this company (separate
        // auto_increment sequences can collide) would wrongly shadow the legitimate fallback and
        // fail with "Объект не принадлежит выбранной компании".
        if (found.isPresent() && company.getId().equals(found.get().getCompanyId())) {
            CompanyObject object = found.get();
            if (!"ACTIVE".equalsIgnoreCase(object.getStatus())) {
                throw new BadRequestException("Объект архивирован", "OBJECT_ARCHIVED");
            }
            protocol.setObjectId(object.getId());
            protocol.setObjectName(object.getName());
            protocol.setObjectNameSnapshot(object.getName());
            protocol.setObjectAddressSnapshot(object.getAddress());
            protocol.setActivityTypeSnapshot(object.getActivityType());
            protocol.setSamplingLocationSnapshot(firstNonBlank(object.getSamplingLocation(), trim(request.measurementPlace())));
            writeObjectSnapshot(protocol, object, trim(request.sourceNumber()));
            return;
        }

        if (request.objectId().equals(company.getId())) {
            applyCompanyObjectFallback(protocol, company, request.measurementPlace(), request.sourceNumber());
            return;
        }

        if (found.isPresent()) {
            throw new BadRequestException("Объект не принадлежит выбранной компании", "OBJECT_COMPANY_MISMATCH");
        }
        throw new NotFoundException("Объект компании не найден", "OBJECT_NOT_FOUND");
    }

    /**
     * Legacy compatibility only: a caller that still sends objectId == companyId (the old
     * "virtual object" convention) is redirected to the company's real primary CompanyObject
     * instead of writing companyId itself into protocol.objectId - every company now has one
     * (created at CompanyService.create() time, or self-healed on first read/write for older
     * data), so there is no longer a legitimate case where companyId has to stand in for a real
     * object id and risk colliding with an unrelated CompanyObject's id.
     */
    private void applyCompanyObjectFallback(Protocol protocol, Company company, String measurementPlace, String sourceNumber) {
        CompanyObject primary = companyObjectRepository.findFirstByCompanyIdAndPrimaryTrue(company.getId())
                .orElseThrow(() -> new NotFoundException(
                        "У компании не настроен объект. Добавьте объект компании перед созданием протокола.",
                        "OBJECT_NOT_FOUND"));
        if (!"ACTIVE".equalsIgnoreCase(primary.getStatus())) {
            throw new BadRequestException("Объект архивирован", "OBJECT_ARCHIVED");
        }
        protocol.setObjectId(primary.getId());
        protocol.setObjectName(primary.getName());
        protocol.setObjectNameSnapshot(primary.getName());
        protocol.setObjectAddressSnapshot(primary.getAddress());
        protocol.setActivityTypeSnapshot(primary.getActivityType());
        protocol.setSamplingLocationSnapshot(firstNonBlank(primary.getSamplingLocation(), trim(measurementPlace)));
        writeObjectSnapshot(protocol, primary, trim(sourceNumber));
    }

    private void writeObjectSnapshot(Protocol protocol, CompanyObject object, String sourceNumber) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            if (object != null) {
                snapshot.put("id", object.getId());
                snapshot.put("name", object.getName());
                snapshot.put("address", object.getAddress());
                snapshot.put("activityType", object.getActivityType());
                snapshot.put("samplingLocation", object.getSamplingLocation());
            }
            if (sourceNumber != null) {
                snapshot.put("sourceNumber", sourceNumber);
            }
            if (!snapshot.isEmpty()) {
                protocol.setObjectSnapshot(objectMapper.writeValueAsString(snapshot));
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось сохранить snapshot объекта", ex);
        }
    }

    private void applyLaboratoryFromRequest(Protocol protocol, ProtocolApiDtos.CreateProtocolRequest request) {
        Laboratory laboratory;
        if (request.laboratoryId() != null) {
            laboratory = laboratoryService.getActiveByIdOrThrow(request.laboratoryId());
        } else {
            laboratory = laboratoryService.resolveDefaultLaboratoryOrThrow();
        }

        LaboratoryEmployee employee = resolveExecutorEmployee(laboratory.getId(), request.executorId());
        mapper.applyLaboratoryFromEntity(protocol, laboratory, employee);
        protocol.setLaboratoryId(laboratory.getId());
        protocol.setExecutorId(employee.getId());
    }

    /**
     * executorId is, by contract, a laboratory_employees.id. For compatibility with older
     * frontend builds that still send users.id, we fall back to a userId lookup within the
     * same laboratory before giving up — but the snapshot always ends up with the real
     * employee.id, never the raw request value. The caller must always name an executor
     * explicitly: this never silently picks "the first active employee" (spec §6).
     */
    private LaboratoryEmployee resolveExecutorEmployee(Long laboratoryId, Long executorId) {
        if (executorId == null) {
            throw new BadRequestException("Укажите исполнителя (executorId)", "EXECUTOR_REQUIRED");
        }
        Optional<LaboratoryEmployee> byId = laboratoryService.findActiveEmployee(laboratoryId, executorId);
        if (byId.isPresent()) {
            return byId.get();
        }
        Optional<LaboratoryEmployee> byUserId = laboratoryService.findActiveEmployeeByUserId(laboratoryId, executorId);
        if (byUserId.isPresent()) {
            return byUserId.get();
        }
        // Distinguish "this employee id doesn't exist/isn't active at all" from "it exists, but in
        // a different laboratory" - the latter is a much more actionable error for the caller.
        if (laboratoryService.findAnyActiveEmployeeById(executorId).isPresent()) {
            throw new BadRequestException(
                    "Исполнитель не относится к выбранной лаборатории", "EXECUTOR_LABORATORY_MISMATCH");
        }
        throw new NotFoundException("Исполнитель лаборатории не найден", "EXECUTOR_NOT_FOUND");
    }
}
