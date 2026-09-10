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
import kz.eco.pek.dto.PekApiDtos;
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
    private final ProtocolContentVersionService contentVersionService;
    private final kz.eco.pek.PekProtocolLinkService pekProtocolLinkService;
    private final kz.eco.signature.EdsSigningPolicyService edsSigningPolicyService;
    private final ProtocolAccessService accessService;
    private final ProtocolReleaseValidationService releaseValidationService;
    private final ProtocolCorrectionCloneService correctionCloneService;
    private final ProtocolSamplingPointRepository samplingPointRepository;

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
                           ProtocolMutationGuard mutationGuard,
                           ProtocolContentVersionService contentVersionService,
                           kz.eco.pek.PekProtocolLinkService pekProtocolLinkService,
                           kz.eco.signature.EdsSigningPolicyService edsSigningPolicyService,
                           ProtocolAccessService accessService,
                           ProtocolReleaseValidationService releaseValidationService,
                           ProtocolCorrectionCloneService correctionCloneService,
                           ProtocolSamplingPointRepository samplingPointRepository) {
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
        this.contentVersionService = contentVersionService;
        this.pekProtocolLinkService = pekProtocolLinkService;
        this.edsSigningPolicyService = edsSigningPolicyService;
        this.accessService = accessService;
        this.releaseValidationService = releaseValidationService;
        this.correctionCloneService = correctionCloneService;
        this.samplingPointRepository = samplingPointRepository;
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
            LocalDate dateFrom, LocalDate dateTo, Boolean published, Integer page, Integer size, String sort,
            boolean includeArchived) {
        int resolvedPage = page != null && page >= 0 ? page : 0;
        int resolvedSize = resolvePageSize(size);
        String templateCode = null;
        if (templateId != null && !templateId.isBlank()) {
            templateCode = ProtocolTemplateCode.fromCode(templateId, subtype).name();
        }
        String normalizedSearch = search != null && !search.isBlank()
                ? search.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") : null;
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(resolvedPage, resolvedSize, resolveSort(sort));

        // P0 module fix item 2: scope is resolved server-side from the actor's real company/
        // laboratory/PEK memberships and applied INSIDE the repository query (never "load
        // everything, then filter in Java") - PROTOCOL_VIEW only means "may use this section",
        // not "may list every protocol in the system".
        kz.eco.user.User scopeActor = kz.eco.auth.CurrentUser.get();
        ProtocolAccessService.ProtocolScope scope = accessService.resolveScope(scopeActor.getId(), scopeActor.getRole());
        var pageResult = protocolRepository.search(status, templateCode, subtype, companyId, objectId,
                laboratoryId, executorId, compliance, dateFrom, dateTo, published, normalizedSearch, includeArchived,
                scope.global(), sentinel(scope.companyIds()), sentinel(scope.laboratoryIds()), scope.executorId(),
                sentinel(scope.extraProtocolIds()), pageable);
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

    /** JPQL "in :collection" with a genuinely empty collection is a portability trap across JPA
     *  providers - substitutes a value that can never match a real id instead, so "no access to
     *  anything on this axis" reliably means zero rows rather than a provider-dependent error. */
    private static Collection<Long> sentinel(Collection<Long> ids) {
        return ids == null || ids.isEmpty() ? Set.of(-1L) : ids;
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
        ProtocolApiDtos.ProtocolPermissions listPermissions =
                permissionService.calculate(p, currentUser, currentVersionSignatures.size(), signedByCurrentUser);
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
                listPermissions,
                listPermissions.toAvailableActions(),
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
        applyLaboratoryFromRequest(protocol, request, userId);
        protocol.setMeasurementTime(trim(request.measurementTime()));
        protocol.setSourceNumber(sanitizeSourceNumber(request.sourceNumber()));
        if (request.measurementPlace() != null && !request.measurementPlace().isBlank()) {
            protocol.setSamplingLocationSnapshot(trim(request.measurementPlace()));
        }
        mapper.applyPrintVisibility(protocol, request.printVisibility());
        // Was previously silently dropped by this method (unlike createDraft/doQuickCreate, which
        // already called linkOrder) - a client sending orderId/orderServiceItemId through the
        // plain POST /api/protocols create path saw it accepted by the DTO but never persisted or
        // validated, contradicting spec item 9's linkage requirement for this endpoint too.
        if (request.orderId() != null && !request.orderId().isBlank()) {
            linkOrder(protocol, request.orderId(), request.orderServiceItemId());
        }

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
     * True server-side draft (module spec §1): only templateId is required. Unlike create()/
     * quickCreate(), company/object/laboratory/executor/dates/order are all optional here, no
     * measurement rows are created, and normative resolution never runs - the record stays a
     * genuine, minimally-filled DRAFT until the caller fills it in via PATCH /{id}/draft and
     * explicitly requests calculate/check-normatives/ready-for-approval.
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse createDraft(ProtocolApiDtos.CreateProtocolDraftRequest request, Long userId) {
        return createDraft(request, userId, null);
    }

    /**
     * Idempotency-Key (optional, task item 6/12): same begin/complete/fail pattern as
     * {@link #quickCreate}, so a double-click/retried draft-create returns the original draft
     * instead of creating a duplicate. Uses the same {@link ProtocolIdempotencyService} - it is
     * keyed by (userId, key) plus a hash of the request payload, not scoped to one endpoint, so
     * reusing it here (rather than inventing a second idempotency mechanism) is correct as long as
     * callers don't reuse the same key across quick-create and drafts for different intents, which
     * the client controls.
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse createDraft(ProtocolApiDtos.CreateProtocolDraftRequest request, Long userId,
                                                         String idempotencyKey) {
        var outcome = idempotencyService.begin(userId, idempotencyKey, request);
        if (outcome instanceof ProtocolIdempotencyService.ReturnExisting existing) {
            return get(existing.protocolId());
        }
        Long idempotencyRecordId = ((ProtocolIdempotencyService.Proceed) outcome).recordId();
        try {
            ProtocolApiDtos.ProtocolResponse response = doCreateDraft(request, userId);
            idempotencyService.complete(idempotencyRecordId, Long.parseLong(response.id()));
            return response;
        } catch (RuntimeException ex) {
            idempotencyService.fail(idempotencyRecordId);
            throw ex;
        }
    }

    private ProtocolApiDtos.ProtocolResponse doCreateDraft(ProtocolApiDtos.CreateProtocolDraftRequest request, Long userId) {
        if (request == null || isBlank(request.templateId())) {
            throw new BadRequestException("Укажите templateId");
        }
        ProtocolTemplate template = resolveTemplate(request.templateId(), request.subtype());
        Protocol protocol = new Protocol();
        protocol.setTemplateId(template.getId());
        protocol.setTemplateCode(template.getCode());
        protocol.setSubtype(request.subtype());
        // protocolNumber allocation needs a year; a draft with no protocolDate yet still needs a
        // number reserved so it has a stable identity, so today's date stands in until the real
        // protocolDate is set via the draft PATCH.
        protocol.setProtocolDate(!isBlank(request.protocolDate())
                ? ProtocolApiMapper.parseDate(request.protocolDate()) : LocalDate.now());

        if (request.companyId() != null) {
            Company company = companyRepository.findById(request.companyId())
                    .orElseThrow(() -> new NotFoundException("Компания не найдена"));
            if (company.getStatus() == CompanyStatus.ARCHIVED) {
                throw new BadRequestException("Нельзя создать протокол для архивной компании");
            }
            copyCompanySnapshotToProtocol(company, protocol);
            protocol.setOrganizationName(company.getName());
            protocol.setOrganizationAddress(company.getLegalAddress() != null
                    ? company.getLegalAddress() : company.getActualAddress());
            protocol.setObjectName(company.getObjectName());
            if (request.objectId() != null) {
                applyObjectById(protocol, company, request.objectId(), null, null);
            }
        }

        if (request.laboratoryId() != null) {
            assertCanAssignLaboratory(request.laboratoryId(), userId);
            Laboratory laboratory = laboratoryService.getActiveByIdOrThrow(request.laboratoryId());
            protocol.setLaboratoryId(laboratory.getId());
            LaboratoryEmployee employee = null;
            if (request.executorId() != null) {
                employee = resolveExecutorEmployee(laboratory.getId(), request.executorId());
                protocol.setExecutorId(employee.getId());
            }
            // Fill the laboratory snapshot as soon as a laboratory is chosen, even before an
            // executor is picked - the snapshot must not stay empty just because executorId is
            // still null (module fix: laboratory data was previously only written when an
            // executor was present too).
            mapper.applyLaboratoryFromEntity(protocol, laboratory, employee);
        }

        if (!isBlank(request.measurementDate())) {
            LocalDate measurementDate = ProtocolApiMapper.parseDate(request.measurementDate());
            protocol.setSampleDate(measurementDate);
            protocol.setTestingStartDate(measurementDate);
        }
        if (!isBlank(request.testingStartDate())) {
            protocol.setTestingStartDate(ProtocolApiMapper.parseDate(request.testingStartDate()));
        }
        if (!isBlank(request.testingEndDate())) {
            protocol.setTestingEndDate(ProtocolApiMapper.parseDate(request.testingEndDate()));
            protocol.setTestDate(protocol.getTestingEndDate());
        }
        if (protocol.getTestingStartDate() != null && protocol.getTestingEndDate() != null
                && protocol.getTestingEndDate().isBefore(protocol.getTestingStartDate())) {
            throw new BadRequestException("Дата окончания испытаний не может быть раньше даты начала");
        }
        if (request.orderId() != null && !request.orderId().isBlank()) {
            linkOrder(protocol, request.orderId(), request.orderServiceItemId());
        }
        mapper.applyPrintVisibility(protocol, request.printVisibility());
        protocol.setSourceNumber(sanitizeSourceNumber(request.sourceNumber()));

        protocol.setStatus(ProtocolStatus.DRAFT);
        protocol.setCreatedBy(userId);
        // saveProtocolWithNumberRetry only re-generates the number on a collision retry - the
        // initial number must already be set before calling it (protocol_number is NOT NULL).
        protocol.setProtocolNumber(numberGenerator.generate(template, protocol.getProtocolDate()));
        saveProtocolWithNumberRetry(protocol, template, true);
        if (request.environment() != null) {
            saveEnvironmentConditions(protocol.getId(), request.environment());
        }

        auditService.log(protocol.getId(), ProtocolAuditAction.CREATED, null, ProtocolStatus.DRAFT, userId,
                "Черновик протокола создан");

        // Save PEK context if provided
        if (request.pekContext() != null) {
            var pekContextRequest = new PekApiDtos.CreateProtocolPekLinkRequest(
                    request.pekContext().pekProgramId(),
                    request.pekContext().pekReportId(),
                    request.pekContext().pekControlItemId(),
                    // Blocker 2: programIndicatorId must reach the canonical link - it used to be
                    // absent from this DTO entirely, so the frontend's value was silently dropped.
                    request.pekContext().programIndicatorId(),
                    request.pekContext().pekControlEventId(),
                    request.pekContext().monitoringPointId(),
                    request.pekContext().emissionSourceId(),
                    request.pekContext().waterOutletId(),
                    request.orderId(),
                    request.orderServiceItemId(),
                    request.pekContext().clientLinkId()
            );
            // Module fix: a failed PEK link (unauthorized, scope mismatch, not found, ...) used to
            // be swallowed here - the protocol still got created, silently leaving the caller
            // believing a PEK link exists when it doesn't. doCreateDraft runs inside the same
            // @Transactional as createDraft(), so letting this propagate rolls the whole draft
            // creation back atomically: either both the protocol and its PEK link exist, or
            // neither does - never a protocol quietly missing the link it was asked to create.
            pekProtocolLinkService.createFromPekContext(protocol.getId(), pekContextRequest, userId);
        }

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
                request.printVisibility(),
                null, null
        );
        ProtocolApiDtos.ProtocolResponse created = create(createRequest, userId);
        Long protocolId = Long.parseLong(created.id());
        Protocol protocol = getOrThrow(protocolId);
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new NotFoundException("Компания не найдена"));
        writeCompanySnapshotJson(protocol, company);
        if (request.orderId() != null && !request.orderId().isBlank()) {
            linkOrder(protocol, request.orderId(), request.orderServiceItemId());
        }
        protocolRepository.save(protocol);

        ProtocolTemplate templateEntity = template(protocol.getTemplateId());
        LocalDate onDate = ProtocolApiMapper.parseDate(measurementDate);
        ProtocolTypeConfig typeConfig = ProtocolTypeRegistry.require(request.templateId(), request.subtype());
        applyQuickCreateEnvironmentConditions(protocol.getId(), request.conditions());

        List<ProtocolApiDtos.QuickCreateMeasurement> measurements = request.measurements();
        for (int i = 0; i < measurements.size(); i++) {
            addQuickCreateMeasurement(protocol, templateEntity, request, measurements.get(i), typeConfig, onDate, i);
        }

        // UPDATED (not a second CREATED - create() above already logged that): this row genuinely
        // stays DRAFT before and after, it's just recording that measurement rows were added.
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, ProtocolStatus.DRAFT, ProtocolStatus.DRAFT, userId,
                "Быстрое создание: добавлено строк " + request.measurements().size());
        // Module spec §1: creation must never silently promote the record past DRAFT. Normative
        // comparison/status promotion only happens when the caller explicitly calls
        // check-normatives (or calculate -> ready-for-approval), never as a side effect of
        // creating rows - a quick-created protocol with data is still a draft until reviewed.
        return get(protocolId);
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
        ProtocolApiDtos.EnvironmentData.TypeConditions typeConditions = new ProtocolApiDtos.EnvironmentData.TypeConditions(
                conditions.season(), conditions.workCategory(), conditions.roomType(), conditions.workplaceType(),
                conditions.lightingType(), conditions.noiseType(), conditions.visualWorkCategory(), conditions.normLevel(),
                conditions.sampleNumber(), conditions.samplingDepth(), conditions.samplingPlace(),
                conditions.waterType(), conditions.waterUseCategory());
        boolean hasTypeConditions = !isBlank(conditions.season()) || !isBlank(conditions.workCategory())
                || !isBlank(conditions.roomType()) || !isBlank(conditions.workplaceType())
                || !isBlank(conditions.lightingType()) || !isBlank(conditions.noiseType())
                || !isBlank(conditions.visualWorkCategory()) || !isBlank(conditions.normLevel())
                || !isBlank(conditions.sampleNumber()) || !isBlank(conditions.samplingDepth())
                || !isBlank(conditions.samplingPlace()) || !isBlank(conditions.waterType())
                || !isBlank(conditions.waterUseCategory());
        if (temperature == null && humidity == null && pressure == null && windSpeed == null
                && !hasWeatherMetadata && !hasTypeConditions) {
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
                conditions.manualChangeReason(),
                hasTypeConditions ? typeConditions : null
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
        checkVersion(protocol, request.version());
        accessService.assertCanEdit(userId, protocol);
        ProtocolTemplate template = template(protocol.getTemplateId());
        if (request.companyId() != null && !request.companyId().equals(protocol.getCompanyId())) {
            throw new BadRequestException("После создания черновика компания протокола не может быть изменена",
                    "PROTOCOL_COMPANY_CHANGE_NOT_ALLOWED");
        }
        if (request.number() != null && !request.number().isBlank()) {
            if (protocol.getStatus() == ProtocolStatus.APPROVED || protocol.getStatus() == ProtocolStatus.SIGNED) {
                throw new BadRequestException("Нельзя менять номер утверждённого протокола");
            }
            protocol.setProtocolNumber(request.number().trim());
        }
        if (request.protocolDate() != null) protocol.setProtocolDate(ProtocolApiMapper.parseDate(request.protocolDate()));
        if (request.objectId() != null) applyObjectChange(protocol, request.objectId());
        boolean canonicalLaboratoryUpdate = applyCanonicalLaboratoryUpdate(protocol, request, userId);
        if (!canonicalLaboratoryUpdate && request.executorId() != null) {
            // executorId always wins over the raw "executor" display-name string - the snapshot
            // is rebuilt from the resolved employee, never trusted from client input (spec §11).
            applyExecutorChange(protocol, request.executorId());
        } else if (!canonicalLaboratoryUpdate && request.executor() != null) {
            protocol.setExecutorName(request.executor());
        }
        if (request.approver() != null) protocol.setHeadOfLaboratoryName(request.approver());
        if (request.sourceNumber() != null) protocol.setSourceNumber(sanitizeSourceNumber(request.sourceNumber()));
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
        if (!canonicalLaboratoryUpdate) mapper.applyLaboratory(protocol, request.laboratory());
        mapper.applyOrganization(protocol, request.organization());
        mapper.applyTesting(protocol, mergeTestingData(request.testing(), request.testingMethodDocument()));
        if (request.instruments() != null) mapper.writeInstruments(protocol, request.instruments());
        if (request.results() != null && !request.results().isEmpty()) {
            syncResults(protocol, template.getCode(), request.results());
        }
        // Unlike results (empty list is a no-op there, see syncResults' caller guard above), an
        // explicit empty samplingPoints list is a real instruction to clear every sampling point -
        // only a completely absent field means "leave sampling points untouched".
        if (request.samplingPoints() != null) {
            syncSamplingPoints(protocol, request.samplingPoints());
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
        if (request.orderId() != null) {
            if (request.orderId().isBlank()) {
                protocol.setOrderId(null);
                protocol.setOrderServiceItemId(null);
            } else {
                linkOrder(protocol, request.orderId(), request.orderServiceItemId());
            }
        } else if (request.orderServiceItemId() != null) {
            linkOrder(protocol, protocol.getOrderId(), request.orderServiceItemId());
        }
        // Any previously generated files are now stale; clear them so the next download
        // (downloadDocx/downloadPdf) renders fresh content from the edited data.
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(id, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, null);
        return toResponse(protocol);
    }

    /** Resolve laboratory and executor together, against the requested laboratory. */
    private boolean applyCanonicalLaboratoryUpdate(Protocol protocol,
                                                    ProtocolApiDtos.UpdateProtocolRequest request,
                                                    Long actorId) {
        ProtocolApiDtos.LaboratoryData data = request.laboratory();
        String rawLaboratoryId = data == null ? null : firstNonBlank(data.laboratoryId(), data.id());
        Long laboratoryId = request.laboratoryId();
        if (laboratoryId == null && !isBlank(rawLaboratoryId)) {
            laboratoryId = parseCanonicalId(rawLaboratoryId, "laboratoryId");
        }
        if (laboratoryId == null) return false;
        assertCanAssignLaboratory(laboratoryId, actorId);
        Long executorId = request.executorId();
        if (executorId == null && data != null && !isBlank(data.executorId())) {
            executorId = parseCanonicalId(data.executorId(), "executorId");
        }
        Laboratory laboratory = laboratoryService.getActiveByIdOrThrow(laboratoryId);
        LaboratoryEmployee employee = executorId == null ? null
                : resolveExecutorEmployee(laboratoryId, executorId);
        mapper.applyLaboratoryFromEntity(protocol, laboratory, employee);
        protocol.setLaboratoryId(laboratoryId);
        protocol.setExecutorId(employee == null ? null : employee.getId());
        return true;
    }

    private static Long parseCanonicalId(String value, String field) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Некорректный " + field);
        }
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
     * Delete endpoint logic (module spec): empty DRAFT (no results) is physically removed; a
     * filled, unsigned, unpublished protocol is soft-deleted (deletedAt set, hidden from
     * GET /api/protocols via ProtocolRepository.search, record kept for history/audit); a signed
     * or published protocol - or one in a terminal workflow state reachable only via cancel()/
     * archive() - returns 409. See Protocol.isDeletable() for the exact rule, shared with
     * ProtocolPermissionService.canDelete so the two can never drift apart - hiding the button in
     * the UI is never itself the security boundary. version is optimistic-lock checked exactly
     * like every other mutating protocol endpoint (checkVersion) - a stale caller gets 409 rather
     * than silently deleting over someone else's concurrent edit.
     */
    @Transactional
    public void delete(Long id, Long version, Long userId) {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        // Scope-only: Protocol#isDeletable() below is deliberately a BROADER status rule than
        // status.isEditable() (e.g. READY_FOR_APPROVAL/APPROVED are deletable but not editable) -
        // assertCanEdit's editable-tier check would wrongly 403 those before reaching the correct
        // domain-specific 409 PROTOCOL_NOT_DELETABLE below.
        accessService.assertCanDelete(userId, protocol);
        boolean empty = resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty();
        if (protocol.getStatus() == ProtocolStatus.DRAFT && empty) {
            auditService.log(id, ProtocolAuditAction.DELETED, protocol.getStatus(), null, userId,
                    "Черновик удалён физически");
            envConditionsRepository.findByProtocolId(id).ifPresent(envConditionsRepository::delete);
            protocolRepository.delete(protocol);
            return;
        }
        ProtocolStatus statusBefore = protocol.getStatus();
        protocol.setDeletedAt(LocalDateTime.now());
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.DELETED, statusBefore, statusBefore, userId,
                "Протокол помечен удалённым (скрыт из списка)");
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse readyForApproval(Long id, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(id);
        checkVersion(protocol, version);
        accessService.assertCanEdit(userId, protocol);
        requireTransition(protocol, ProtocolStatus.READY_FOR_APPROVAL);
        validateReadyForApproval(protocol);
        ProtocolStatus old = protocol.getStatus();
        Long oldContentVersion = protocol.getContentVersion();
        protocol.setStatus(ProtocolStatus.READY_FOR_APPROVAL);
        bumpContentVersion(protocol);
        auditService.log(id, ProtocolAuditAction.READY_FOR_APPROVAL, old, protocol.getStatus(), userId,
                "Готов к утверждению", oldContentVersion, protocol.getContentVersion());
        return toResponse(protocol);
    }

    /** Sends a protocol back for revision (NEEDS_REVISION) instead of all the way to DRAFT -
     *  distinct from returnToDraft(), which is the older, coarser reset. */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnForRevision(Long id, Long version, String reason, Long userId) {
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину возврата на доработку", "REASON_REQUIRED");
        }
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.NEEDS_REVISION);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.NEEDS_REVISION);
        bumpContentVersion(protocol);
        auditService.log(id, ProtocolAuditAction.RETURNED_FOR_REVISION, old, protocol.getStatus(), userId,
                reason.trim());
        return toResponse(protocol);
    }

    private void requireTransition(Protocol protocol, ProtocolStatus target) {
        if (!protocol.getStatus().canTransitionTo(target)) {
            throw new ConflictException(
                    "Переход из " + protocol.getStatus() + " в " + target + " недопустим",
                    "PROTOCOL_INVALID_TRANSITION");
        }
    }

    /**
     * P1 module fix item 8: APPROVE binds to one specific, verified PDF snapshot. The internal
     * generateDocx/generatePdf calls below are the "system generation" item 7 talks about
     * (distinct from the user-facing regenerate endpoints, which are blocked once APPROVED) -
     * they refresh the documents from current data one last time before certifying them.
     * requireApprovablePdf then re-verifies, right before certifying, that the PDF that was just
     * (re)generated genuinely reflects protocol.getContentVersion() and that its stored hash
     * matches its actual bytes - approvedPdfHash/approvedContentVersion freeze exactly that
     * verified state, which sign() later re-checks bit-for-bit rather than trusting the live
     * pdf* fields (which move every time someone regenerates).
     */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse approve(Long id, Long version, Long userId) throws IOException {
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.APPROVED);
        validateBeforeApprove(protocol);
        documentService.generateDocx(id, userId);
        documentService.generatePdf(id, userId);
        protocol = getOrThrow(id);
        requireApprovablePdf(protocol);
        ProtocolStatus old = protocol.getStatus();
        Long oldContentVersion = protocol.getContentVersion();
        protocol.setStatus(ProtocolStatus.APPROVED);
        protocol.setApprovedBy(userId);
        protocol.setApprovedAt(LocalDateTime.now());
        protocol.setApprovedPdfHash(protocol.getPdfSha256());
        protocol.setApprovedContentVersion(protocol.getContentVersion());
        auditService.log(id, ProtocolAuditAction.APPROVED, old, protocol.getStatus(), userId, null,
                oldContentVersion, protocol.getContentVersion());
        return toResponse(protocol);
    }

    /** Condition for APPROVE (module fix item 8): a PDF must exist, must have been rendered from
     *  the protocol's CURRENT contentVersion (not a stale snapshot), and its stored hash must
     *  match its actual bytes on disk/storage (defends against a corrupted or externally-tampered
     *  stored file, not just a logically-stale one). */
    void requireApprovablePdf(Protocol protocol) {
        if (protocol.getPdfFileId() == null) {
            throw new ConflictException("PDF протокола не сформирован", "PROTOCOL_PDF_MISSING");
        }
        if (!java.util.Objects.equals(protocol.getPdfSourceContentVersion(), protocol.getContentVersion())) {
            throw new ConflictException(
                    "PDF устарел относительно текущих данных протокола - сформируйте документ заново",
                    "PROTOCOL_PDF_STALE");
        }
        byte[] bytes;
        try {
            bytes = fileStorageService.load(protocol.getPdfFileId()).inputStream().readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Не удалось прочитать PDF протокола для проверки", ex);
        }
        String actualHash = sha256Hex(bytes);
        if (protocol.getPdfSha256() == null || !actualHash.equalsIgnoreCase(protocol.getPdfSha256())) {
            throw new ConflictException(
                    "Сохранённый PDF повреждён или не соответствует ожидаемому hash", "PROTOCOL_PDF_HASH_MISMATCH");
        }
    }

    /** Condition for the FIRST SIGN (module fix item 8) - every link in the chain from "what
     *  approve() certified" to "what's about to be signed" must still hold: the live PDF must
     *  still be current (pdfSourceContentVersion == contentVersion), the protocol's content must
     *  not have moved since approval (approvedContentVersion == contentVersion), the live PDF's
     *  hash must equal the hash approve() certified (pdfSha256 == approvedPdfHash), and the
     *  ACTUAL bytes on disk/storage must still hash to that same value. Any single mismatch means
     *  either the protocol was edited after approval (should be impossible without
     *  returnToDraft(), but checked explicitly rather than only relied upon) or the stored file
     *  was corrupted/tampered with - either way, signing is refused rather than silently signing
     *  something other than what was actually approved. */
    void requireSignablePdf(Protocol protocol) {
        if (protocol.getPdfFileId() == null) {
            throw new ConflictException("PDF протокола не сформирован", "PROTOCOL_PDF_MISSING");
        }
        if (!java.util.Objects.equals(protocol.getPdfSourceContentVersion(), protocol.getContentVersion())) {
            throw new ConflictException(
                    "Документ устарел - данные протокола изменились после его формирования", "PROTOCOL_PDF_STALE");
        }
        if (!java.util.Objects.equals(protocol.getApprovedContentVersion(), protocol.getContentVersion())) {
            throw new ConflictException(
                    "Протокол был изменён после утверждения - требуется повторное согласование",
                    "PROTOCOL_APPROVAL_STALE");
        }
        if (protocol.getApprovedPdfHash() == null
                || !protocol.getApprovedPdfHash().equalsIgnoreCase(protocol.getPdfSha256())) {
            throw new ConflictException(
                    "Документ не соответствует утверждённой версии", "PROTOCOL_PDF_HASH_MISMATCH");
        }
        byte[] bytes;
        try {
            bytes = fileStorageService.load(protocol.getPdfFileId()).inputStream().readAllBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Не удалось прочитать PDF протокола для подписания", ex);
        }
        String actualHash = sha256Hex(bytes);
        if (!actualHash.equalsIgnoreCase(protocol.getApprovedPdfHash())) {
            throw new ConflictException(
                    "Сохранённый файл повреждён или не соответствует утверждённой версии",
                    "PROTOCOL_PDF_HASH_MISMATCH");
        }
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
        checkVersion(protocol, request != null ? request.version() : null);
        boolean additionalSigner = protocol.getStatus() == ProtocolStatus.SIGNED;
        kz.eco.user.User actor = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + userId));
        // Module fix item 5: signing always goes through the formal APPROVED review path now (the
        // READY-based self-sign shortcut is retired). Once already SIGNED, additional signers
        // don't go through a status transition at all.
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
        // Module fix: close the sign bypass. The controller's @PreAuthorize(LAB_PROTOCOL) is
        // intentionally broad (it also allows a lab executor to complete+sign a READY protocol on
        // their own - module spec item 1's shortcut), but ProtocolService.sign() itself never
        // re-checked the role - meaning a LABORATORY user could call this endpoint directly and
        // sign an APPROVED/SIGNED protocol even though ProtocolPermissionService.canSign (and thus
        // the UI) says only a supervisor may. ProtocolAccessService.assertCanSign enforces the
        // exact same rule the permissions/UI layer advertises (single source of truth - see its
        // javadoc). Checked after the already-signed/signature-limit checks above so those keep
        // their own specific error codes instead of being masked by the generic forbidden code.
        accessService.assertCanSign(userId, id);
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
        // Module fix item 8: no auto-regeneration here - a PDF regenerated at sign time could
        // silently differ from the one approve() actually certified. The first signer must sign
        // exactly the already-approved PDF; requireSignablePdf verifies that bit-for-bit.
        // Additional signers (protocol already SIGNED) verify against the frozen pdfSha256
        // separately, right below.
        if (!additionalSigner) {
            requireSignablePdf(protocol);
        }
        if (signingProperties.isBlockFallbackPdf() && protocol.isPdfIsFallback()) {
            throw new ConflictException(
                    "PDF сформирован резервным рендерером (LibreOffice недоступен) - подписание запрещено",
                    "PDF_FALLBACK_NOT_SIGNABLE");
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
        kz.eco.user.User signer = actor;
        edsSigningPolicyService.requireCertificateOwnedByCurrentUser(signatureInfo, signer);
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
        Long oldContentVersion = protocol.getContentVersion();
        if (!additionalSigner) {
            protocol.setSignatureFileId(sig.fileId());
            protocol.setPdfSha256(currentPdfSha256);
            protocol.setSignatureCertificateMetadata(writeCertificateMetadata(signatureInfo));
            protocol.setStatus(ProtocolStatus.SIGNED);
            protocol.setSignedBy(userId);
            protocol.setSignedAt(LocalDateTime.now());
            bumpContentVersion(protocol);
            // Module spec item 6: @Version only increments in memory once Hibernate actually
            // flushes the UPDATE - without forcing that here, the ProtocolSignature persisted just
            // below would record the STALE pre-flush version instead of the real one this signature
            // was made against.
            protocol = protocolRepository.saveAndFlush(protocol);
        }
        Long signingVersion = protocol.getVersion();
        ProtocolSignature signature = new ProtocolSignature();
        signature.setProtocolId(id);
        signature.setProtocolVersion(signingVersion);
        signature.setUserId(userId);
        signature.setSignerFullName(signer != null && signer.getName() != null ? signer.getName() : signatureInfo.commonName());
        signature.setSignerPosition(signer != null ? signer.getPosition() : null);
        signature.setPdfSha256(currentPdfSha256);
        signature.setFileId(sig.fileId());
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
        auditService.log(id, additionalSigner ? ProtocolAuditAction.SECOND_SIGNATURE : ProtocolAuditAction.SIGNED,
                old, protocol.getStatus(), userId,
                (additionalSigner ? "Дополнительный подписант: " : "Подписант: ")
                        + signatureInfo.commonName() + ", ИИН: " + signatureInfo.serialNumber()
                        + ", подписей: " + (signatureCountBefore + 1) + "/" + maxSignatures,
                oldContentVersion, protocol.getContentVersion());
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

        // P1 module fix item 6: the full clone (header + results + raw measurements + environment)
        // now lives in ProtocolCorrectionCloneService, which copies every business-aggregate field
        // reflectively rather than a hand-maintained list that silently drops newly-added columns.
        Protocol copy = correctionCloneService.cloneHeader(old, template, userId, id, request.reason());
        protocolRepository.save(copy);
        // Forward pointer completes the bidirectional chain (spec §24) - the backward pointer
        // (copy.replacedProtocolId = old.id) is already set inside cloneHeader().
        old.setReplacedByProtocolId(copy.getId());
        protocolRepository.save(old);
        correctionCloneService.cloneResultsAndMeasurements(id, copy.getId());
        correctionCloneService.cloneEnvironment(id, copy.getId());
        auditService.log(id, ProtocolAuditAction.REPLACED, oldStatus, ProtocolStatus.REPLACED, userId, request.reason());
        auditService.log(copy.getId(), ProtocolAuditAction.CREATED, null, ProtocolStatus.DRAFT, userId, "Копия протокола " + id);
        return toResponse(copy);
    }

    /** Validates the order exists and isn't already finished before linking it to a new protocol
     *  (spec §25) - a completed/cancelled order can't gain a new lab deliverable retroactively. */
    private void linkOrder(Protocol protocol, String orderId) {
        linkOrder(protocol, orderId, null);
    }

    /** Module spec §8: orderServiceItemId is only meaningful paired with orderId - there is no
     *  OrderServiceItem entity/table in kz.eco.order yet, so this can only validate the pairing
     *  and that the named order actually exists/is open, not that the item id belongs to it. */
    private void linkOrder(Protocol protocol, String orderId, String orderServiceItemId) {
        if (isBlank(orderId)) {
            if (!isBlank(orderServiceItemId)) {
                throw new BadRequestException(
                        "orderServiceItemId указан без orderId", "ORDER_SERVICE_ITEM_REQUIRES_ORDER");
            }
            return;
        }
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Заявка не найдена: " + orderId));
        if (order.getStatus() == OrderStatus.COMPLETED || order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("Нельзя создать протокол для завершённой или отменённой заявки");
        }
        // Module spec item 9 (enforceable subset - see report): Order's company reference
        // (businessCompanyId) is a String, not the Long FK protocol.companyId points at, so this
        // can only be checked when it parses cleanly as the same id - a non-numeric/blank
        // businessCompanyId (e.g. a CRM-only order not yet tied to a Company row) is left
        // unchecked rather than rejected, since there is nothing concrete to compare against.
        if (protocol.getCompanyId() != null && !isBlank(order.getBusinessCompanyId())) {
            try {
                Long orderCompanyId = Long.valueOf(order.getBusinessCompanyId().trim());
                if (!orderCompanyId.equals(protocol.getCompanyId())) {
                    throw new BadRequestException(
                            "Заявка " + orderId + " принадлежит другой компании и не может быть привязана к протоколу",
                            "ORDER_COMPANY_MISMATCH");
                }
            } catch (NumberFormatException ignored) {
                // businessCompanyId isn't a Company.id - nothing concrete to compare, skip.
            }
        }
        protocol.setOrderId(order.getId());
        protocol.setOrderServiceItemId(isBlank(orderServiceItemId) ? null : orderServiceItemId.trim());
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
    public ProtocolApiDtos.ProtocolResponse cancel(Long id, Long version, String reason, Long userId) {
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину аннулирования протокола", "REASON_REQUIRED");
        }
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        requireTransition(protocol, ProtocolStatus.CANCELLED);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.CANCELLED);
        protocolRepository.save(protocol);
        auditService.log(id, ProtocolAuditAction.CANCELLED, old, protocol.getStatus(), userId, reason.trim());
        return toResponse(protocol);
    }

    /** Soft-archive: CANCELLED/REPLACED -> ARCHIVED per the canonical workflow. Distinct from the
     *  hard delete() below, which only ever removes an empty DRAFT. */
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

    @Transactional
    public ProtocolApiDtos.ProtocolResponse returnToDraft(Long id, Long version, String reason, Long userId) {
        // P1 module fix item 3: version and reason are both mandatory - the caller's real reason
        // must reach the audit log verbatim, never a fixed placeholder string.
        if (version == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину возврата в черновик", "REASON_REQUIRED");
        }
        String trimmedReason = reason.trim();
        Protocol protocol = getOrThrow(id);
        checkVersion(protocol, version);
        if (protocol.getStatus() == ProtocolStatus.DRAFT) {
            return toResponse(protocol);
        }
        requireTransition(protocol, ProtocolStatus.DRAFT);
        ProtocolStatus old = protocol.getStatus();
        protocol.setStatus(ProtocolStatus.DRAFT);
        bumpContentVersion(protocol);
        auditService.log(id, ProtocolAuditAction.RETURNED_TO_DRAFT, old, ProtocolStatus.DRAFT, userId, trimmedReason);
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse attachMeasurementDevice(Long protocolId,
                                                                   ProtocolApiDtos.AttachMeasurementDeviceRequest request,
                                                                   Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, request.version());
        accessService.assertCanEdit(userId, protocol);
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
        clearGeneratedDocuments(protocol);
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
        accessService.assertCanEdit(userId, protocol);
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
        clearGeneratedDocuments(protocol);
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
        accessService.assertCanEdit(userId, protocol);
        ProtocolTemplate template = template(protocol.getTemplateId());
        validateResultBody(body);
        if (isManualNormativeOverride(body)) {
            requireManualNormativeOverridePermission(protocolId, userId);
        }
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocolId);
        result.setRowNumber(nextRowNumber(protocolId));
        ProtocolResultValuesMapper.applyValues(template.getCode(), result,
                ProtocolResultValuesMapper.fromRequestBody(body));
        validateSamplingPoint(protocol, result);
        applyMeasurementDeviceFromBody(result, body);
        validateMeasurementDevice(result);
        enrichNormative(protocol, template.getCode(), result);
        normativeCheckService.compareResult(result, new ArrayList<>());
        resultRepository.save(result);
        ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, "Добавлена строка");
        logManualNormativeOverrideIfApplicable(protocol, result, body, null, null, null, null, userId);
        return ProtocolResultResponseMapper.toResponse(result);
    }

    @Transactional
    public Map<String, Object> addResult(Long protocolId, ProtocolApiDtos.ResultRow request, Long version, Long userId) {
        Map<String, Object> body = ProtocolResultValuesMapper.fromResultRow(request);
        body.put("version", version);
        return addResult(protocolId, body, userId);
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
        accessService.assertCanEdit(userId, protocol);
        ProtocolTemplate template = template(protocol.getTemplateId());
        if (isManualNormativeOverride(body)) {
            requireManualNormativeOverridePermission(protocol.getId(), userId);
        }
        BigDecimal oldNormativeValue = result.getNormativeValue();
        BigDecimal oldMinValue = result.getMinValue();
        BigDecimal oldMaxValue = result.getMaxValue();
        String oldComparisonType = result.getComparisonType() != null ? result.getComparisonType().name() : null;
        ProtocolResultValuesMapper.applyValues(template.getCode(), result,
                ProtocolResultValuesMapper.fromRequestBody(body));
        validateSamplingPoint(protocol, result);
        applyMeasurementDeviceFromBody(result, body);
        validateMeasurementDevice(result);
        enrichNormative(protocol, template.getCode(), result);
        normativeCheckService.compareResult(result, new ArrayList<>());
        resultRepository.save(result);
        ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocol.getId(), ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId, "Обновлена строка");
        logManualNormativeOverrideIfApplicable(protocol, result, body,
                oldNormativeValue, oldMinValue, oldMaxValue, oldComparisonType, userId);
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

    /** Atomic add/update/delete of result rows in a single transaction (draft-results batch).
     *  One version check, one contentVersion/JPA-version bump, one audit entry, one stale-file
     *  invalidation - all-or-nothing, so a partial failure (bad row id, invalid device, ...)
     *  rolls back the whole batch. Idempotency-Key (optional): same begin/complete/fail pattern
     *  as {@link #createDraft} via the shared {@link ProtocolIdempotencyService}, so a retried
     *  request with the same key returns the original result instead of re-applying the batch. */
    @Transactional
    public ProtocolApiDtos.ProtocolResponse saveDraftResultsBatch(Long protocolId,
                                                                   ProtocolApiDtos.DraftResultsBatchRequest request,
                                                                   Long userId, String idempotencyKey) {
        var outcome = idempotencyService.begin(userId, idempotencyKey, request);
        if (outcome instanceof ProtocolIdempotencyService.ReturnExisting existing) {
            return get(existing.protocolId());
        }
        Long idempotencyRecordId = outcome instanceof ProtocolIdempotencyService.Proceed proceed ? proceed.recordId() : null;
        try {
            ProtocolApiDtos.ProtocolResponse response = doSaveDraftResultsBatch(protocolId, request, userId);
            if (idempotencyRecordId != null) {
                idempotencyService.complete(idempotencyRecordId, protocolId);
            }
            return response;
        } catch (RuntimeException ex) {
            if (idempotencyRecordId != null) {
                idempotencyService.fail(idempotencyRecordId);
            }
            throw ex;
        }
    }

    private ProtocolApiDtos.ProtocolResponse doSaveDraftResultsBatch(Long protocolId,
                                                                      ProtocolApiDtos.DraftResultsBatchRequest request,
                                                                      Long userId) {
        if (request != null && request.results() != null) {
            throw new BadRequestException(
                    "Устаревший формат запроса: поле 'results' больше не поддерживается, "
                            + "используйте added/updated/deletedIds", "LEGACY_RESULTS_FIELD");
        }
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, request != null ? request.version() : null);
        accessService.assertCanEdit(userId, protocol);
        ProtocolTemplate template = template(protocol.getTemplateId());

        List<ProtocolApiDtos.DraftResultCreateRequest> added =
                request != null && request.added() != null ? request.added() : List.of();
        List<ProtocolApiDtos.DraftResultUpdateRequest> updated =
                request != null && request.updated() != null ? request.updated() : List.of();
        List<Long> deletedIds =
                request != null && request.deletedIds() != null ? request.deletedIds() : List.of();

        List<Long> ownedIdsToCheck = new ArrayList<>();
        for (ProtocolApiDtos.DraftResultUpdateRequest req : updated) {
            if (req.id() == null) {
                throw new BadRequestException("Не указан id обновляемой строки");
            }
            ownedIdsToCheck.add(req.id());
        }
        ownedIdsToCheck.addAll(deletedIds);
        Map<Long, ProtocolResult> ownedById = ownedIdsToCheck.isEmpty() ? Map.of() :
                loadOwnedResults(protocolId, ownedIdsToCheck).stream()
                        .collect(java.util.stream.Collectors.toMap(ProtocolResult::getId, r -> r));

        for (ProtocolApiDtos.DraftResultUpdateRequest req : updated) {
            ProtocolResult result = ownedById.get(req.id());
            String oldNormVal = result.getNormativeValue() != null ? result.getNormativeValue().toPlainString() : null;
            String oldMin = result.getMinValue() != null ? result.getMinValue().toPlainString() : null;
            String oldMax = result.getMaxValue() != null ? result.getMaxValue().toPlainString() : null;
            String oldCmp = result.getComparisonType() != null ? result.getComparisonType().name() : null;
            Long oldNormId = result.getNormativeId();
            Map<String, Object> values = draftUpdateValues(req);
            ProtocolResultValuesMapper.applyValues(template.getCode(), result, values);
            validateSamplingPoint(protocol, result);
            validateMeasurementDevice(result);
            enrichNormative(protocol, template.getCode(), result);
            normativeCheckService.compareResult(result, new ArrayList<>());
            resultRepository.save(result);
            ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
            if (result.getNormativeId() == null && (result.getNormativeValue() != null || result.getMinValue() != null || result.getMaxValue() != null)) {
                String reason = String.valueOf(values.getOrDefault("manualNormativeReason",
                        values.getOrDefault("reason", "")));
                auditService.log(protocolId, ProtocolAuditAction.MANUAL_NORMATIVE_OVERRIDE,
                        protocol.getStatus(), protocol.getStatus(), userId,
                        "Ручной ввод норматива (пакетно): reason=\"" + reason + "\", было(value=" + oldNormVal
                                + ",min=" + oldMin + ",max=" + oldMax + ",cmp=" + oldCmp
                                + ",normativeId=" + oldNormId + "), стало(value="
                                + (result.getNormativeValue() != null ? result.getNormativeValue().toPlainString() : null)
                                + ",min=" + (result.getMinValue() != null ? result.getMinValue().toPlainString() : null)
                                + ",max=" + (result.getMaxValue() != null ? result.getMaxValue().toPlainString() : null)
                                + ",cmp=" + (result.getComparisonType() != null ? result.getComparisonType().name() : null) + ")");
            }
        }

        for (ProtocolApiDtos.DraftResultCreateRequest req : added) {
            ProtocolResult result = new ProtocolResult();
            result.setProtocolId(protocolId);
            result.setRowNumber(nextRowNumber(protocolId));
            Map<String, Object> values = draftCreateValues(req);
            ProtocolResultValuesMapper.applyValues(template.getCode(), result, values);
            validateSamplingPoint(protocol, result);
            validateMeasurementDevice(result);
            enrichNormative(protocol, template.getCode(), result);
            normativeCheckService.compareResult(result, new ArrayList<>());
            resultRepository.save(result);
            ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
            if (result.getNormativeId() == null && (result.getNormativeValue() != null || result.getMinValue() != null || result.getMaxValue() != null)) {
                String reason = String.valueOf(values.getOrDefault("manualNormativeReason",
                        values.getOrDefault("reason", "")));
                auditService.log(protocolId, ProtocolAuditAction.MANUAL_NORMATIVE_OVERRIDE,
                        protocol.getStatus(), protocol.getStatus(), userId,
                        "Ручной ввод норматива (пакетно, новая строка): reason=\"" + reason + "\", value="
                                + (result.getNormativeValue() != null ? result.getNormativeValue().toPlainString() : null)
                                + ",min=" + (result.getMinValue() != null ? result.getMinValue().toPlainString() : null)
                                + ",max=" + (result.getMaxValue() != null ? result.getMaxValue().toPlainString() : null)
                                + ",cmp=" + (result.getComparisonType() != null ? result.getComparisonType().name() : null));
            }
        }

        if (!deletedIds.isEmpty()) {
            resultRepository.deleteAll(deletedIds.stream().map(ownedById::get).toList());
        }

        // Module spec: version only advances after a real data change - a true no-op delta
        // (added/updated/deletedIds all empty) must not bump contentVersion, clear generated
        // documents, or write an audit entry.
        if (!added.isEmpty() || !updated.isEmpty() || !deletedIds.isEmpty()) {
            clearGeneratedDocuments(protocol);
            bumpContentVersion(protocol);
            protocolRepository.saveAndFlush(protocol);

            auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(),
                    userId, "Изменены строки результатов (пакетно)");
        }

        return toResponse(getOrThrow(protocolId));
    }

    private static Map<String, Object> draftCreateValues(ProtocolApiDtos.DraftResultCreateRequest req) {
        Map<String, Object> values = req.values() != null ? new LinkedHashMap<>(req.values()) : new LinkedHashMap<>();
        if (req.normativeId() != null) {
            values.put("normativeId", req.normativeId());
        }
        if (req.measurementDeviceId() != null) {
            values.put("measurementDeviceId", req.measurementDeviceId());
        }
        if (req.samplingPointId() != null) values.put("samplingPointId", req.samplingPointId());
        if (req.clientRowId() != null) {
            values.put("clientRowId", req.clientRowId());
        }
        return values;
    }

    private static Map<String, Object> draftUpdateValues(ProtocolApiDtos.DraftResultUpdateRequest req) {
        Map<String, Object> values = req.values() != null ? new LinkedHashMap<>(req.values()) : new LinkedHashMap<>();
        if (req.normativeId() != null) {
            values.put("normativeId", req.normativeId());
        }
        if (req.measurementDeviceId() != null) {
            values.put("measurementDeviceId", req.measurementDeviceId());
        }
        if (req.samplingPointId() != null) values.put("samplingPointId", req.samplingPointId());
        return values;
    }

    private void validateSamplingPoint(Protocol protocol, ProtocolResult result) {
        boolean ambientAir = "AMBIENT_AIR_SZZ".equalsIgnoreCase(protocol.getTemplateCode());
        // Compatibility boundary: protocols created before V101 may legitimately have only the
        // legacy sampling_place text and no point rows. Once a protocol opts into the normalized
        // model by creating its first point, every AMBIENT_AIR_SZZ result is strictly required to
        // reference one. V101 backfills point rows wherever legacy sampling_place is available.
        if (ambientAir && samplingPointRepository.existsByProtocolId(protocol.getId())
                && result.getSamplingPointId() == null) {
            throw new BadRequestException("Для AMBIENT_AIR_SZZ укажите samplingPointId",
                    "SAMPLING_POINT_REQUIRED");
        }
        if (result.getSamplingPointId() != null && samplingPointRepository
                .findByIdAndProtocolId(result.getSamplingPointId(), protocol.getId()).isEmpty()) {
            throw new BadRequestException("Точка отбора не принадлежит протоколу",
                    "SAMPLING_POINT_PROTOCOL_MISMATCH");
        }
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
        accessService.assertCanEdit(userId, protocol);
        resultRepository.delete(result);
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(result.getProtocolId(), ProtocolAuditAction.UPDATED, ProtocolStatus.DRAFT, ProtocolStatus.DRAFT, userId, "Удалена строка");
        return toResponse(getOrThrow(protocolId));
    }

    /** Module fix: version is mandatory for every client-facing mutation - null used to mean
     *  "skip the check entirely", making optimistic locking opt-in rather than enforced. A caller
     *  that never read the protocol has no business mutating it. Internal, protocol-creation-time
     *  callers (e.g. populating a brand-new protocol's initial rows before any client could have
     *  seen a version) must go through {@link #checkVersionInternal}, never this one. */
    private void checkVersion(Protocol protocol, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(protocol.getVersion())) {
            throw new ConflictException("Протокол был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }
    }

    /** Skips the version-required check - only for mutations that happen as part of creating the
     *  protocol itself, within the same transaction, before any client could possibly have read a
     *  version to send back. Never call this from a method reachable directly from a controller. */
    private void checkVersionInternal(Protocol protocol, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(protocol.getVersion())) {
            throw new ConflictException("Протокол был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }
    }

    /** Document generation had no concurrency guard at all (unlike check-normatives/
     *  refresh-laboratory-data) - a stale client could regenerate a DOCX/PDF against data it
     *  hasn't actually seen. Uses a distinct code (not OPTIMISTIC_LOCK_CONFLICT) per this
     *  hardening pass's explicit contract for generation endpoints. Version is mandatory, same as
     *  {@link #checkVersion}. */
    private void checkVersionForGeneration(Protocol protocol, Long requestVersion) {
        if (requestVersion == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (!requestVersion.equals(protocol.getVersion())) {
            throw new ConflictException("Протокол был изменён другим пользователем", "VERSION_CONFLICT");
        }
    }

    /** Module spec §5: the plain JPA {@code version} on Protocol does not reliably advance when
     *  only a child row changes (ProtocolResult/MeasurementDevice/ProtocolSignature/environment
     *  conditions/...) - addResult/updateResult/deleteResult etc. never call
     *  protocolRepository.save(protocol) at all today, so a concurrent PATCH against a stale
     *  Protocol.version would not be caught. Call this at the end of every mutation that changes
     *  what the protocol means, even ones that only touch a child table, so contentVersion is a
     *  trustworthy aggregate-level optimistic-lock token. */
    private void bumpContentVersion(Protocol protocol) {
        contentVersionService.bump(protocol);
    }

    /** Module spec item 2: any change to results/devices/calculations invalidates the last
     *  generated DOCX/PDF - they must never be silently reused (or handed to sign()) once the
     *  content they were rendered from has moved. Call this alongside bumpContentVersion from
     *  every mutation that touches results, devices, or normative/calculation state. */
    private void clearGeneratedDocuments(Protocol protocol) {
        protocol.setDocxFileId(null);
        protocol.setPdfFileId(null);
        protocol.setPdfIsFallback(false);
        protocol.setPdfSourceContentVersion(null);
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
        accessService.assertCanEdit(userId, protocol);
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
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовая смена прибора для строк: " + rows.size());
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse bulkUpdatePlace(Long protocolId, List<Long> resultIds,
                                                            String measurementPlace, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        accessService.assertCanEdit(userId, protocol);
        if (isBlank(measurementPlace)) {
            throw new BadRequestException("Укажите measurementPlace");
        }
        List<ProtocolResult> rows = loadOwnedResults(protocolId, resultIds);
        for (ProtocolResult r : rows) {
            r.setSamplingPlace(measurementPlace.trim());
            r.setMeasurementPlace(measurementPlace.trim());
        }
        resultRepository.saveAll(rows);
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовое изменение места отбора для строк: " + rows.size());
        return toResponse(protocol);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse bulkDeleteResults(Long protocolId, List<Long> resultIds,
                                                              Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        accessService.assertCanEdit(userId, protocol);
        List<ProtocolResult> rows = loadOwnedResults(protocolId, resultIds);
        resultRepository.deleteAll(rows);
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Массовое удаление строк: " + rows.size());
        return toResponse(getOrThrow(protocolId));
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
        accessService.assertCanEdit(userId, protocol);
        normativeCheckService.checkProtocol(protocolId, protocol.getObjectName(),
                protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
        protocol = getOrThrow(protocolId);
        if (protocol.getStatus() == ProtocolStatus.DRAFT) {
            protocol.setStatus(ProtocolStatus.CALCULATED);
        }
        // Every result row's normative/min/max/comparisonType may have just been rewritten by
        // checkProtocol() above, even when the status doesn't change (e.g. re-running the check on
        // an already-CALCULATED protocol) - bump unconditionally, not just on the status branch.
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        auditService.log(protocolId, ProtocolAuditAction.NORMATIVE_CHECK, protocol.getStatus(), protocol.getStatus(), userId, null);
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse refreshLaboratoryData(Long protocolId, Long version, Long userId) {
        Protocol protocol = getEditableOrThrow(protocolId);
        checkVersion(protocol, version);
        accessService.assertCanEdit(userId, protocol);
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
        clearGeneratedDocuments(protocol);
        bumpContentVersion(protocol);
        protocolRepository.save(protocol);
        auditService.log(protocolId, ProtocolAuditAction.UPDATED, protocol.getStatus(), protocol.getStatus(), userId,
                "Обновлены данные лаборатории");
        return toResponse(protocol);
    }

    // Reads audit history directly from ProtocolAuditLogRepository (via the mapper's
    // loadHistory) instead of building a full ProtocolResponse - the latter also loads the
    // template, every result row, and the whole snapshot just to discard everything but the
    // history list.
    @Transactional(readOnly = true)
    public List<ProtocolApiDtos.HistoryItem> audit(Long protocolId, Long userId) {
        accessService.assertCanView(userId, protocolId);
        return mapper.loadHistory(protocolId);
    }

    /** For SIGNED/REPLACED: returns the immutable stored PDF (hash-verified) instead of triggering
     *  a new buildPdf() render. Signed PDFs are immutable artifacts - re-rendering from current
     *  data would produce a document that no longer matches the recorded pdfSha256/contentVersion,
     *  which is misleading (and wrong for audit purposes). */
    public byte[] preview(Long protocolId, Long userId) throws IOException {
        accessService.assertCanView(userId, protocolId);
        Protocol protocol = getOrThrow(protocolId);
        if (isSignedOrLater(protocol)) {
            if (protocol.getPdfFileId() == null) {
                throw new SignedDocumentIntegrityException(
                        "У подписанного протокола отсутствует сохранённый файл PDF для предпросмотра");
            }
            StoredFileContent stored = fileStorageService.load(protocol.getPdfFileId());
            byte[] bytes;
            try (var in = stored.inputStream()) {
                bytes = in.readAllBytes();
            }
            if (protocol.getPdfSha256() != null && !protocol.getPdfSha256().equals(sha256Hex(bytes))) {
                throw new SignedDocumentIntegrityException(
                        "Сохранённый PDF не соответствует hash, зафиксированному при подписании");
            }
            return bytes;
        }
        return documentService.generatePreview(protocolId);
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse generateDocx(Long protocolId, Long version, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        checkVersionForGeneration(protocol, version);
        // Scope-only for the actor-relationship check - status eligibility is enforced separately
        // right below by requireUserRegenerationAllowed, since the editable-tier assertCanEdit
        // would wrongly 403 (instead of the correct domain 409) here.
        accessService.assertCanView(userId, protocol);
        requireUserRegenerationAllowed(protocol);
        documentService.generateDocx(protocolId, userId);
        return toResponse(getOrThrow(protocolId));
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse generatePdf(Long protocolId, Long version, Long userId) throws IOException {
        Protocol protocol = getOrThrow(protocolId);
        checkVersionForGeneration(protocol, version);
        accessService.assertCanView(userId, protocol);
        requireUserRegenerationAllowed(protocol);
        documentService.generatePdf(protocolId, userId);
        return toResponse(getOrThrow(protocolId));
    }

    /** P1 module fix item 7: user-facing generate/regenerate-docx/pdf must never be allowed to
     *  replace an already-approved document - only status.isEditable() protocols qualify (DRAFT/
     *  CALCULATED/NEEDS_REVISION). This is deliberately a SEPARATE, stricter gate from
     *  ProtocolMutationGuard's GENERATE_DOCX/PDF policy (which also allows READY_FOR_APPROVAL/
     *  APPROVED) - that guard still protects the INTERNAL calls approve()/sign() make directly to
     *  {@link ProtocolDocumentGenerationService}, bypassing this method entirely. Changing an
     *  APPROVED protocol's documents is only ever possible via returnToDraft() first. */
    private void requireUserRegenerationAllowed(Protocol protocol) {
        if (!protocol.getStatus().isEditable()) {
            throw new ConflictException(
                    "Документ утверждённого протокола нельзя перегенерировать - сначала верните протокол в черновик",
                    "PROTOCOL_APPROVED_REGENERATION_FORBIDDEN");
        }
    }

    /** Falls back to an on-demand render when no stored file exists yet (e.g. right after an
     * edit cleared the stale docxFileId) so downloading never requires a separate generate step.
     * Once the protocol has actually been signed, the stored DOCX is part of the signed package
     * (module spec §6.3) and is served as-is, never silently re-rendered. */
    public StoredFileContent downloadDocx(Long protocolId, Long userId) throws IOException {
        accessService.assertCanDownload(userId, protocolId);
        Protocol protocol = getOrThrow(protocolId);
        StoredFileContent result;
        if (protocol.getDocxFileId() == null) {
            if (isSignedOrLater(protocol)) {
                throw new SignedDocumentIntegrityException(
                        "У подписанного протокола отсутствует сохранённый файл DOCX");
            }
            byte[] content = documentService.renderDocx(protocolId);
            result = new StoredFileContent(protocol.getProtocolNumber() + ".docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    new java.io.ByteArrayInputStream(content));
        } else {
            result = fileStorageService.load(protocol.getDocxFileId());
        }
        // Audit AFTER successful file retrieval — never log DOWNLOADED for failed attempts
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "docx");
        return result;
    }

    /** See {@link #downloadDocx}: renders on demand when no stored PDF exists yet. Once signed,
     * this is the actual cryptographically-signed artifact (module spec §6) - its bytes are
     * re-hashed against the sha256 recorded at signing time before being served, and any mismatch
     * or missing file is a hard integrity error, never a silent re-render (§6.6-§6.8). */
    public StoredFileContent downloadPdf(Long protocolId, Long userId) throws IOException {
        accessService.assertCanDownload(userId, protocolId);
        Protocol protocol = getOrThrow(protocolId);
        StoredFileContent result;
        if (protocol.getPdfFileId() == null) {
            if (isSignedOrLater(protocol)) {
                throw new SignedDocumentIntegrityException(
                        "У подписанного протокола отсутствует сохранённый файл PDF");
            }
            byte[] content = documentService.renderPdf(protocolId);
            result = new StoredFileContent(protocol.getProtocolNumber() + ".pdf", "application/pdf",
                    new java.io.ByteArrayInputStream(content));
        } else {
            StoredFileContent stored = fileStorageService.load(protocol.getPdfFileId());
            if (protocol.getPdfSha256() == null) {
                result = stored;
            } else {
                byte[] bytes;
                try (var in = stored.inputStream()) {
                    bytes = in.readAllBytes();
                }
                if (!protocol.getPdfSha256().equals(sha256Hex(bytes))) {
                    throw new SignedDocumentIntegrityException(
                            "Сохранённый PDF не соответствует hash, зафиксированному при подписании");
                }
                result = new StoredFileContent(stored.filename(), stored.contentType(), new java.io.ByteArrayInputStream(bytes));
            }
        }
        // Audit AFTER successful file retrieval and hash check — never log DOWNLOADED for failures
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "pdf");
        return result;
    }

    /** Renders straight from the real template on demand; does not require a prior generate-docx
     * call. Forbidden once signed (module spec §6.7 "не выполнять on-demand render подписанного
     * PDF" - extended here to DOCX too, since it is part of the same signed snapshot/package). */
    public StoredFileContent downloadDocxRendered(Long protocolId, Long userId) throws IOException {
        accessService.assertCanDownload(userId, protocolId);
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
        accessService.assertCanDownload(userId, protocolId);
        Protocol protocol = getOrThrow(protocolId);
        mutationGuard.requireEditable(protocol, ProtocolMutationAction.GENERATE_PDF);
        byte[] content = documentService.renderPdf(protocolId);
        auditService.log(protocolId, ProtocolAuditAction.DOWNLOADED, protocol.getStatus(), protocol.getStatus(), userId, "pdf");
        return new StoredFileContent(protocol.getProtocolNumber() + ".pdf", "application/pdf",
                new java.io.ByteArrayInputStream(content));
    }

    private static boolean isSignedOrLater(Protocol protocol) {
        return protocol.getStatus() == ProtocolStatus.APPROVED
                || protocol.getStatus() == ProtocolStatus.SIGNED || protocol.getStatus() == ProtocolStatus.REPLACED
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
            validateSamplingPoint(protocol, result);
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

    /** Bulk reconciliation of sampling points as part of a single PATCH /api/protocols/{id}
     *  transaction (module fix) - mirrors syncResults' create/update-by-id/delete-missing shape,
     *  but each point additionally validated for lat/long range and for "not still referenced by a
     *  result" before deletion, same rule {@link ProtocolSamplingPointService#delete} enforces for
     *  its own single-point endpoint (SAMPLING_POINT_HAS_RESULTS, 409) - a point missing from the
     *  request is a real delete instruction, never silently ignored or orphaning its results. */
    private void syncSamplingPoints(Protocol protocol, List<ProtocolApiDtos.SamplingPointRequest> requests) {
        List<ProtocolSamplingPoint> existing = samplingPointRepository
                .findByProtocolIdOrderBySortOrderAscIdAsc(protocol.getId());
        Map<Long, ProtocolSamplingPoint> existingById = existing.stream()
                .collect(java.util.stream.Collectors.toMap(ProtocolSamplingPoint::getId, p -> p));
        Set<Long> keepIds = new java.util.HashSet<>();
        int sortOrder = 0;

        for (ProtocolApiDtos.SamplingPointRequest request : requests) {
            validateSamplingPointRequest(request);
            ProtocolSamplingPoint point;
            if (request.id() != null) {
                point = existingById.get(request.id());
                if (point == null) {
                    throw new BadRequestException(
                            "Точка отбора " + request.id() + " не относится к протоколу " + protocol.getId(),
                            "SAMPLING_POINT_NOT_FOUND");
                }
                if (request.version() != null && !request.version().equals(point.getVersion())) {
                    throw new ConflictException(
                            "Точка отбора была изменена другим пользователем", "PROTOCOL_VERSION_CONFLICT");
                }
                keepIds.add(point.getId());
            } else {
                point = new ProtocolSamplingPoint();
                point.setProtocolId(protocol.getId());
            }
            point.setName(request.name().trim());
            point.setDescription(request.description());
            point.setLatitude(request.latitude());
            point.setLongitude(request.longitude());
            point.setSortOrder(request.sortOrder() != null ? request.sortOrder() : sortOrder);
            sortOrder++;
            point = samplingPointRepository.saveAndFlush(point);
            keepIds.add(point.getId());
        }

        for (ProtocolSamplingPoint old : existing) {
            if (keepIds.contains(old.getId())) {
                continue;
            }
            long resultCount = samplingPointRepository.countResultsByPointId(old.getId());
            if (resultCount > 0) {
                throw new ConflictException(
                        "Точка отбора \"" + old.getName() + "\" содержит " + resultCount
                                + " результатов. Удалите или переназначьте их перед удалением точки.",
                        "SAMPLING_POINT_HAS_RESULTS");
            }
            samplingPointRepository.delete(old);
        }
    }

    private static void validateSamplingPointRequest(ProtocolApiDtos.SamplingPointRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("Укажите название точки отбора (name)", "SAMPLING_POINT_NAME_REQUIRED");
        }
        if (request.latitude() != null && (request.latitude().compareTo(new java.math.BigDecimal("-90")) < 0
                || request.latitude().compareTo(new java.math.BigDecimal("90")) > 0)) {
            throw new BadRequestException("latitude должна быть в диапазоне от -90 до 90", "INVALID_LATITUDE");
        }
        if (request.longitude() != null && (request.longitude().compareTo(new java.math.BigDecimal("-180")) < 0
                || request.longitude().compareTo(new java.math.BigDecimal("180")) > 0)) {
            throw new BadRequestException("longitude должна быть в диапазоне от -180 до 180", "INVALID_LONGITUDE");
        }
    }

    private static Long parseLongSafe(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Long.parseLong(value); }
        catch (NumberFormatException e) { return null; }
    }

    private void enrichNormative(Protocol protocol, String templateCode, ProtocolResult result) {
        String normalizedCode = templateCode != null ? templateCode.trim().toLowerCase() : null;
        normativeCheckService.applyNormativeToResult(
                result, normalizedCode, protocol.getObjectName(),
                protocol.getTestDate() != null ? protocol.getTestDate() : protocol.getProtocolDate());
    }

    /** True when the request body sets a normative manually (value/min/max/comparisonType) rather
     *  than picking one by normativeId - the entry point ProtocolNormativeCheckService.
     *  applyNormativeFromSnapshot's "reason required" gate protects. */
    private boolean isManualNormativeOverride(Map<String, Object> body) {
        Map<String, Object> values = ProtocolResultValuesMapper.fromRequestBody(body);
        Object normativeId = values.get("normativeId");
        if (normativeId != null && !String.valueOf(normativeId).isBlank()) {
            return false;
        }
        return values.get("normativeValue") != null || values.get("value") != null
                || values.get("normativeMin") != null || values.get("min") != null
                || values.get("normativeMax") != null || values.get("max") != null
                || values.get("comparisonType") != null;
    }

    /** Module fix: manual normative changes need a dedicated server-side permission check, not
     *  just "whatever role can call addResult/updateResult at all" - kept identical to
     *  LAB_PROTOCOL_ROLES today (there is no narrower role in the current role model), but checked
     *  explicitly and separately so a future stricter role can be dropped in here without touching
     *  the general result-mutation path. */
    private void requireManualNormativeOverridePermission(Long protocolId, Long userId) {
        accessService.assertCanManageResults(userId, protocolId);
    }

    /** Module fix: audit every manual normative override with actor/timestamp/reason/old-new
     *  normative (old* params are null for a brand-new row via addResult). */
    private void logManualNormativeOverrideIfApplicable(Protocol protocol, ProtocolResult result, Map<String, Object> body,
                                                          BigDecimal oldValue, BigDecimal oldMin, BigDecimal oldMax,
                                                          String oldComparisonType, Long userId) {
        if (!isManualNormativeOverride(body)) {
            return;
        }
        Map<String, Object> values = ProtocolResultValuesMapper.fromRequestBody(body);
        String reason = String.valueOf(values.get("reason"));
        String comment = "Ручной ввод норматива: причина=\"" + reason + "\", было(value=" + oldValue
                + ", min=" + oldMin + ", max=" + oldMax + ", comparisonType=" + oldComparisonType
                + "), стало(value=" + result.getNormativeValue() + ", min=" + result.getMinValue()
                + ", max=" + result.getMaxValue()
                + ", comparisonType=" + (result.getComparisonType() != null ? result.getComparisonType().name() : null) + ")";
        auditService.log(protocol.getId(), ProtocolAuditAction.MANUAL_NORMATIVE_OVERRIDE,
                protocol.getStatus(), protocol.getStatus(), userId, comment);
    }

    /**
     * Module spec §1: strict full-protocol validation runs only at this transition (and
     * calculate/approve/sign, which reuse it) - never at draft creation/edit. Every violation is
     * collected into one structured response ({@link ValidationException} -&gt;
     * {@code fieldErrors}) instead of failing fast on the first one, so the caller sees the whole
     * list of missing fields in a single round trip.
     */
    private void validateReadyForApproval(Protocol protocol) {
        List<kz.eco.common.ApiFieldError> errors = new ArrayList<>();
        if (isBlank(protocol.getProtocolNumber())) {
            errors.add(new kz.eco.common.ApiFieldError("protocolNumber", "REQUIRED", "Заполните номер протокола"));
        }
        if (protocol.getProtocolDate() == null) {
            errors.add(new kz.eco.common.ApiFieldError("protocolDate", "REQUIRED", "Заполните дату протокола"));
        }
        if (isBlank(protocol.getOrganizationName())) {
            errors.add(new kz.eco.common.ApiFieldError("organizationName", "REQUIRED", "Заполните организацию"));
        }
        if (isBlank(protocol.getObjectName())) {
            errors.add(new kz.eco.common.ApiFieldError("objectName", "REQUIRED", "Заполните объект"));
        }
        if (protocol.getSampleDate() == null) {
            errors.add(new kz.eco.common.ApiFieldError("sampleDate", "REQUIRED", "Заполните дату отбора"));
        }
        if (protocol.getTestDate() == null) {
            errors.add(new kz.eco.common.ApiFieldError("testDate", "REQUIRED", "Заполните дату испытаний"));
        }
        if (isBlank(protocol.getTestingMethodNd())) {
            errors.add(new kz.eco.common.ApiFieldError(
                    "testingMethodDocument", "REQUIRED", "Укажите НД на методы испытаний"));
        }
        if (isBlank(protocol.getExecutorName())) {
            errors.add(new kz.eco.common.ApiFieldError("executorId", "REQUIRED", "Укажите исполнителя"));
        }
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        if (results.isEmpty()) {
            errors.add(new kz.eco.common.ApiFieldError("results", "REQUIRED", "Добавьте хотя бы одну строку результата"));
        }
        for (ProtocolResult r : results) {
            String prefix = "results[" + r.getRowNumber() + "]";
            if (normativeCheckService.resolveComparableValue(r) == null) {
                errors.add(new kz.eco.common.ApiFieldError(
                        prefix + ".value", "VALUE_NOT_PROVIDED", "Строка " + r.getRowNumber() + ": нет значения результата"));
            }
            if ("WAITING_INPUTS".equals(r.getCalculationStatus())) {
                errors.add(new kz.eco.common.ApiFieldError(
                        prefix + ".calculationStatus", "CALCULATION_WAITING_INPUTS",
                        "Строка " + r.getRowNumber() + ": не заполнены исходные данные"));
            }
            if ("ERROR".equals(r.getCalculationStatus())) {
                errors.add(new kz.eco.common.ApiFieldError(
                        prefix + ".calculationStatus", "CALCULATION_ERROR",
                        "Строка " + r.getRowNumber() + ": ошибка расчёта"));
            }
            if ("NEEDS_REPEAT".equals(r.getCalculationStatus())) {
                errors.add(new kz.eco.common.ApiFieldError(
                        prefix + ".calculationStatus", "CALCULATION_NEEDS_REPEAT",
                        "Строка " + r.getRowNumber() + ": требуется повторный анализ"));
            }
        }
        errors.addAll(validateAgainstTypePolicyForPersistedProtocol(protocol, results));
        errors.addAll(collectNormativeAndDeviceErrors(results));
        if (!errors.isEmpty()) {
            throw new ValidationException("Протокол заполнен не полностью", errors);
        }
    }

    /** Module spec item 5: before a protocol leaves DRAFT (readyForApproval), every result row's
     *  normative must be an actually-active catalog entry (not merely selected-but-inactive, not
     *  unselected) and every attached measurement device must currently pass verification -
     *  aggregated as field errors alongside the rest of validateReadyForApproval's checks, rather
     *  than failing fast on the first bad row, so the client sees every problem at once. This is
     *  in addition to (not a replacement for) validateBeforeSign's own fail-fast re-check
     *  immediately before signing, which guards against the protocol/results changing again after
     *  readyForApproval already ran. */
    private List<kz.eco.common.ApiFieldError> collectNormativeAndDeviceErrors(List<ProtocolResult> results) {
        List<kz.eco.common.ApiFieldError> errors = new ArrayList<>(releaseValidationService.collectFieldErrors(results));
        for (ProtocolResult r : results) {
            String prefix = "results[" + r.getRowNumber() + "]";
            if (r.getDeviceId() != null) {
                MeasurementDevice device = deviceRepository.findById(r.getDeviceId()).orElse(null);
                if (device == null) {
                    errors.add(new kz.eco.common.ApiFieldError(prefix + ".deviceId", "MEASUREMENT_DEVICE_NOT_FOUND",
                            "Строка \"" + safeIndicatorName(r) + "\": прибор не найден"));
                } else {
                    device.refreshStatus();
                    if (!device.isVerificationValid()) {
                        errors.add(new kz.eco.common.ApiFieldError(prefix + ".deviceId", "MEASUREMENT_DEVICE_NOT_VERIFIED",
                                "Строка \"" + safeIndicatorName(r) + "\": просрочена поверка прибора"));
                    }
                }
            }
        }
        return errors;
    }

    /**
     * Adapts the persisted protocol/result-row state into {@link ProtocolValidationContext}/
     * {@link MeasurementInput} and runs it through the same {@link ProtocolValidationPolicyRegistry}
     * used by quick-create (see {@link #validateAgainstTypePolicy(ProtocolApiDtos.QuickCreateProtocolRequest)}).
     * Previously ready-for-approval only ran the structural checks above - a protocol could reach
     * READY_FOR_APPROVAL/APPROVED/SIGNED with e.g. no roomType/workplaceType/lightingType declared
     * for a lighting protocol, or no factorType/factorCode for uv_emf_laser, as long as it entered
     * via draft/PATCH instead of quick-create. This closes that gap without duplicating the policy
     * classes themselves.
     */
    private List<kz.eco.common.ApiFieldError> validateAgainstTypePolicyForPersistedProtocol(
            Protocol protocol, List<ProtocolResult> results) {
        ProtocolTemplate template = template(protocol.getTemplateId());
        String templateKey;
        try {
            templateKey = ProtocolTemplateCode.valueOf(template.getCode()).toApiId();
        } catch (IllegalArgumentException ex) {
            return List.of();
        }
        ProtocolValidationPolicy policy = validationPolicyRegistry.resolve(templateKey);
        ProtocolEnvironmentConditions env = envConditionsRepository.findByProtocolId(protocol.getId()).orElse(null);
        Map<String, Object> conditions = toConditionsMap(env);
        ProtocolValidationContext context = new ProtocolValidationContext(
                protocol.getCompanyId(), protocol.getObjectId(), protocol.getLaboratoryId(), protocol.getExecutorId(),
                protocol.getProtocolDate() != null ? protocol.getProtocolDate().toString() : null,
                protocol.getSampleDate() != null ? protocol.getSampleDate().toString() : null,
                protocol.getTestingStartDate() != null ? protocol.getTestingStartDate().toString() : null,
                protocol.getTestingEndDate() != null ? protocol.getTestingEndDate().toString() : null,
                protocol.getSamplingLocationSnapshot(), conditions);
        List<ProtocolValidationError> errors = new ArrayList<>(policy.validateHeader(context));
        for (int i = 0; i < results.size(); i++) {
            ProtocolResult r = results.get(i);
            Map<String, Object> extras = ProtocolResultValuesMapper.readValuesMap(r);
            Object factorCode = extras.get("factorCode");
            errors.addAll(policy.validateMeasurement(i, context, new MeasurementInput(
                    r.getSubtype(), factorCode != null ? String.valueOf(factorCode) : null,
                    r.getPollutantCode(), r.getIndicatorName(),
                    normativeCheckService.resolveComparableValue(r), r.getUnit(),
                    r.getNormativeId(), r.getDeviceId())));
        }
        return errors.stream()
                .map(e -> new kz.eco.common.ApiFieldError(e.field(), e.code(), e.message()))
                .toList();
    }

    private static Map<String, Object> toConditionsMap(ProtocolEnvironmentConditions env) {
        if (env == null) {
            return Map.of();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        putIfPresent(map, "season", env.getSeason());
        putIfPresent(map, "workCategory", env.getWorkCategory());
        putIfPresent(map, "workplaceType", env.getWorkplaceType());
        putIfPresent(map, "roomType", env.getRoomType());
        putIfPresent(map, "normLevel", env.getNormLevel());
        putIfPresent(map, "sampleNumber", env.getSampleNumber());
        putIfPresent(map, "samplingDepth", env.getSamplingDepth());
        putIfPresent(map, "samplingPlace", env.getSamplingPlace());
        putIfPresent(map, "lightingType", env.getLightingType());
        putIfPresent(map, "noiseType", env.getNoiseType());
        putIfPresent(map, "visualWorkCategory", env.getVisualWorkCategory());
        putIfPresent(map, "waterType", env.getWaterType());
        putIfPresent(map, "waterUseCategory", env.getWaterUseCategory());
        putIfPresent(map, "factorType", env.getFactorType());
        return map;
    }

    /** module spec item 3, narrower half: manual normative entry (no normativeId, but a
     *  client-supplied value/min/max/comparisonType) is pervasive EXISTING behavior across this
     *  module (every ProtocolApiTestSupport fixture and most real templates rely on it, and
     *  ProtocolNormativeCheckService's own javadoc documents it as intentional pending a frontend
     *  manualNormative{reason} contract that does not exist yet) - gating it on a permission+reason
     *  here would 400 the overwhelming majority of today's addResult/updateResult calls with no
     *  way for an existing caller to supply the missing reason. What sign() DOES enforce (see
     *  validateBeforeSign below) is the narrower, safe-to-ship half: a result whose normative was
     *  never resolved at all (NORMATIVE_NOT_SELECTED) or resolved to an inactive catalog record
     *  (NORMATIVE_INACTIVE) can never reach a signed document. */

    private static String safeIndicatorName(ProtocolResult r) {
        return r.getIndicatorName() != null && !r.getIndicatorName().isBlank()
                ? r.getIndicatorName() : "строка " + r.getRowNumber();
    }

    private void validateBeforeApprove(Protocol protocol) {
        validateReadyForApproval(protocol);
        if (isBlank(protocol.getHeadOfLaboratoryName()) && isBlank(protocol.getDirectorName())) {
            throw new BadRequestException("Укажите утверждающего (руководитель лаборатории или директор)");
        }
    }

    private void validateBeforeSign(Protocol protocol) {
        validateBeforeApprove(protocol);
        // Defense-in-depth (module spec item 14): ready-for-approval already enforces full
        // type-specific validation before a protocol can reach an approvable state, but sign is
        // re-checked too in case the protocol/results were mutated between READY_FOR_APPROVAL and
        // sign (e.g. a supervisor edit, or a status reached via a path that skipped the gate).
        List<ProtocolResult> currentResults = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocol.getId());
        List<kz.eco.common.ApiFieldError> typeErrors = validateAgainstTypePolicyForPersistedProtocol(protocol, currentResults);
        if (!typeErrors.isEmpty()) {
            throw new ValidationException("Протокол не прошёл проверку перед подписанием", typeErrors);
        }
        // Server-side hard-blocker gate (module spec item 3/8): ProtocolReleaseValidationService is
        // the single source of truth for which result-row states may never reach a released
        // protocol, checked identically here and in validateReadyForApproval (via
        // collectNormativeAndDeviceErrors) - a row whose normative was never resolved, resolved to
        // an inactive/not-found record, has a unit mismatch, or has no comparable value at all must
        // never reach a signed document.
        releaseValidationService.requireNoHardBlockers(currentResults);
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
        Map<String, List<kz.eco.common.ApiFieldError>> blockers = collectActionBlockers(protocol);
        List<ProtocolApiDtos.SamplingPointResponse> samplingPoints = samplingPointRepository
                .findByProtocolIdOrderBySortOrderAscIdAsc(protocol.getId()).stream()
                .map(ProtocolApiDtos.SamplingPointResponse::from)
                .toList();
        return mapper.toProtocol(protocol, template, results, env, blockers, samplingPoints);
    }

    /** Dry-run of each workflow transition to surface concrete field blockers per action.
     *  Catches validation exceptions rather than throwing them, so a GET /{id} never fails
     *  because the protocol is incomplete - it just reports what would block each action. */
    private Map<String, List<kz.eco.common.ApiFieldError>> collectActionBlockers(Protocol protocol) {
        Map<String, List<kz.eco.common.ApiFieldError>> blockers = new LinkedHashMap<>();
        ProtocolStatus status = protocol.getStatus();
        if (status.canTransitionTo(ProtocolStatus.READY_FOR_APPROVAL)) {
            List<kz.eco.common.ApiFieldError> errors = tryCollectReadyForApprovalErrors(protocol);
            if (!errors.isEmpty()) {
                blockers.put("sendToApproval", errors);
            }
        }
        if (status == ProtocolStatus.READY_FOR_APPROVAL) {
            List<kz.eco.common.ApiFieldError> errors = tryCollectReadyForApprovalErrors(protocol);
            if (isBlank(protocol.getHeadOfLaboratoryName()) && isBlank(protocol.getDirectorName())) {
                errors = new ArrayList<>(errors);
                errors.add(new kz.eco.common.ApiFieldError("approver", "REQUIRED",
                        "Укажите утверждающего (руководитель лаборатории или директор)"));
            }
            if (!errors.isEmpty()) {
                blockers.put("approve", errors);
            }
        }
        if (status == ProtocolStatus.APPROVED || status == ProtocolStatus.SIGNED) {
            List<kz.eco.common.ApiFieldError> errors = tryCollectReadyForApprovalErrors(protocol);
            if (!errors.isEmpty()) {
                blockers.put("sign", errors);
            }
        }
        return blockers.isEmpty() ? Map.of() : blockers;
    }

    private List<kz.eco.common.ApiFieldError> tryCollectReadyForApprovalErrors(Protocol protocol) {
        try {
            validateReadyForApproval(protocol);
            return List.of();
        } catch (ValidationException e) {
            return e.getDetails() != null ? e.getDetails() : List.of();
        } catch (BadRequestException e) {
            return List.of(new kz.eco.common.ApiFieldError(null, e.getCode(), e.getMessage()));
        } catch (Exception e) {
            return List.of();
        }
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
                                           LocalDate onDate,
                                           int measurementIndex) {
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

        // Module spec: normativeId is the priority source when the client sends one - it must
        // never be silently re-resolved/overridden by our own automatic search (that was exactly
        // the bug: resolveForQuickCreate always ran first, so a user's deliberate selection could
        // lose to an unrelated auto-match). A present-but-invalid id is a client error - it means
        // the frontend claimed a specific, presumably UI-selected normative that no longer exists
        // (deleted/archived/typo), so this fails loud (400) rather than silently falling through to
        // "no normative found", per module spec §1 ("не допускать молчаливый сброс normativeId").
        if (!isBlank(measurement.normativeId())) {
            Long explicitNormativeId = toLongOrNull(measurement.normativeId());
            if (explicitNormativeId == null) {
                throw new ValidationException("Некорректный ID норматива", "NORMATIVE_NOT_FOUND",
                        Map.of("measurements[" + measurementIndex + "].normativeId", "Некорректный ID норматива"));
            }
            ProtocolNormativeCheckService.NormativeResolutionOutcome outcome =
                    normativeCheckService.resolveClientSelectedNormativeById(result, explicitNormativeId);
            if (outcome == ProtocolNormativeCheckService.NormativeResolutionOutcome.INACTIVE) {
                throw new ValidationException("Выбранный норматив архивирован", "NORMATIVE_INACTIVE",
                        Map.of("measurements[" + measurementIndex + "].normativeId", "Норматив архивирован"));
            }
            if (outcome != ProtocolNormativeCheckService.NormativeResolutionOutcome.RESOLVED) {
                throw new ValidationException("Выбранный норматив не найден", "NORMATIVE_NOT_FOUND",
                        Map.of("measurements[" + measurementIndex + "].normativeId", "Норматив не найден"));
            }
            normativeCheckService.compareResult(result, new ArrayList<>());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of("normativeSearchStatus", "MATCHED"));
            applyMeasurementDeviceForQuickCreate(result, measurement, onDate);
            resultRepository.save(result);
            ensureInstrumentIncludesDevice(protocol, result.getDeviceId());
            return;
        }

        ProtocolNormativeCheckService.NormativeResolution normative = normativeCheckService.resolveForQuickCreate(
                request.templateId(), measurement, request.conditions(), onDate);
        if (normative.found()) {
            NormativeSnapshotHelper.applySnapshotToResult(result, normative.normative());
            normativeCheckService.compareResult(result, new ArrayList<>());
            ProtocolResultValuesMapper.mergeNormativeSnapshot(result, Map.of("normativeSearchStatus", "MATCHED"));
        } else if (!isBlank(measurement.normativeValue())) {
            // Client already resolved/selected the normative on its side (normativeValue supplied,
            // no normativeId); trust it rather than blocking on our own lookup missing/being ambiguous.
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
        // Merge, not replace: env.conditions() is null whenever the caller (e.g. update()'s
        // request.environment()) doesn't carry the type-specific condition sub-object at all, and
        // that must never wipe out values a prior quick-create/save already persisted here. Within
        // a non-null TypeConditions, only non-blank fields overwrite - a blank field means "not
        // provided this time", matching the same putIfPresent convention used everywhere else this
        // data is assembled (e.g. ProtocolService.toConditionsMap).
        if (env.conditions() != null) {
            ProtocolApiDtos.EnvironmentData.TypeConditions c = env.conditions();
            mergeCondition(c.season(), conditions::setSeason);
            mergeCondition(c.workCategory(), conditions::setWorkCategory);
            mergeCondition(c.roomType(), conditions::setRoomType);
            mergeCondition(c.workplaceType(), conditions::setWorkplaceType);
            mergeCondition(c.lightingType(), conditions::setLightingType);
            mergeCondition(c.noiseType(), conditions::setNoiseType);
            mergeCondition(c.visualWorkCategory(), conditions::setVisualWorkCategory);
            mergeCondition(c.normLevel(), conditions::setNormLevel);
            mergeCondition(c.sampleNumber(), conditions::setSampleNumber);
            mergeCondition(c.samplingDepth(), conditions::setSamplingDepth);
            mergeCondition(c.samplingPlace(), conditions::setSamplingPlace);
            mergeCondition(c.waterType(), conditions::setWaterType);
            mergeCondition(c.waterUseCategory(), conditions::setWaterUseCategory);
            mergeCondition(c.factorType(), conditions::setFactorType);
        }
        envConditionsRepository.save(conditions);
    }

    private static void mergeCondition(String incoming, java.util.function.Consumer<String> setter) {
        if (incoming != null && !incoming.isBlank()) {
            setter.accept(incoming.trim());
        }
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
        applyObjectById(protocol, company, request.objectId(), request.measurementPlace(), request.sourceNumber());
    }

    private void applyObjectById(Protocol protocol, Company company, Long objectId, String measurementPlace, String sourceNumber) {
        if (objectId == null) {
            if (measurementPlace != null && !measurementPlace.isBlank()) {
                protocol.setSamplingLocationSnapshot(trim(measurementPlace));
            }
            if (sourceNumber != null && !sourceNumber.isBlank()) {
                writeObjectSnapshot(protocol, null, trim(sourceNumber));
            }
            return;
        }

        Optional<CompanyObject> found = companyObjectRepository.findById(objectId);
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
            protocol.setSamplingLocationSnapshot(firstNonBlank(object.getSamplingLocation(), trim(measurementPlace)));
            writeObjectSnapshot(protocol, object, trim(sourceNumber));
            return;
        }

        if (objectId.equals(company.getId())) {
            applyCompanyObjectFallback(protocol, company, measurementPlace, sourceNumber);
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

    private void applyLaboratoryFromRequest(Protocol protocol, ProtocolApiDtos.CreateProtocolRequest request,
                                             Long actorId) {
        Laboratory laboratory;
        if (request.laboratoryId() != null) {
            assertCanAssignLaboratory(request.laboratoryId(), actorId);
            laboratory = laboratoryService.getActiveByIdOrThrow(request.laboratoryId());
        } else {
            laboratory = laboratoryService.resolveDefaultLaboratoryOrThrow();
        }

        LaboratoryEmployee employee = resolveExecutorEmployee(laboratory.getId(), request.executorId());
        mapper.applyLaboratoryFromEntity(protocol, laboratory, employee);
        protocol.setLaboratoryId(laboratory.getId());
        protocol.setExecutorId(employee.getId());
    }

    /** LABORATORY users may only assign a laboratory that belongs to their own active scope.
     *  ADMIN/DIRECTOR/HEAD have global scope and may assign any lab. Other roles (MANAGER etc.)
     *  never reach this path because they cannot write protocols. */
    private void assertCanAssignLaboratory(Long laboratoryId, Long actorId) {
        kz.eco.user.User actor = userRepository.findById(actorId).orElse(null);
        if (actor == null || actor.getRole() != kz.eco.user.UserRole.LABORATORY) {
            return;
        }
        ProtocolAccessService.ProtocolScope scope = accessService.resolveScope(actorId, actor.getRole());
        if (!scope.global() && !scope.laboratoryIds().contains(laboratoryId)) {
            throw new BadRequestException(
                    "Лаборатория не входит в вашу область полномочий", "LABORATORY_SCOPE_VIOLATION");
        }
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
