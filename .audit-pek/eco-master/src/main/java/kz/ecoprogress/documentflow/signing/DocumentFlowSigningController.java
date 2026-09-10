package kz.ecoprogress.documentflow.signing;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.signing.dto.AuditEventDto;
import kz.ecoprogress.documentflow.signing.dto.CurrentAssignmentDto;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/document-flow/documents/{id}")
public class DocumentFlowSigningController {

    private final SigningRouteService routeService;
    private final SigningService signingService;
    private final SigningResponseMapper mapper;
    private final SigningAssignmentRepository assignmentRepository;
    private final DocumentService documentService;
    private final DocumentFlowAuditLogRepository auditLogRepository;
    private final DocumentFlowAccessService accessService;
    private final UserRepository userRepository;

    public DocumentFlowSigningController(SigningRouteService routeService,
                                          SigningService signingService,
                                          SigningResponseMapper mapper,
                                          SigningAssignmentRepository assignmentRepository,
                                          DocumentService documentService,
                                          DocumentFlowAuditLogRepository auditLogRepository,
                                          DocumentFlowAccessService accessService,
                                          UserRepository userRepository) {
        this.routeService = routeService;
        this.signingService = signingService;
        this.mapper = mapper;
        this.assignmentRepository = assignmentRepository;
        this.documentService = documentService;
        this.auditLogRepository = auditLogRepository;
        this.accessService = accessService;
        this.userRepository = userRepository;
    }

    /** Module spec §18: DocumentFlowAuditService writes rows, but nothing ever read them back. */
    @GetMapping("/audit")
    public ApiResponse<PageResponse<AuditEventDto>> audit(@PathVariable Long id,
                                                           @RequestParam(required = false) String eventType,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        Long userId = CurrentUser.get().getId();
        Document document = documentService.getOrThrow(id);
        accessService.requirePermission(userId, document.getOrganizationId(), DocumentFlowPermission.VIEW_AUDIT_LOG);
        var pageable = PageRequest.of(page, Math.min(size, 100),
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        var entries = (eventType != null && !eventType.isBlank())
                ? auditLogRepository.findAllByDocumentIdAndActionOrderByCreatedAtDesc(id, eventType, pageable)
                : auditLogRepository.findAllByDocumentIdOrderByCreatedAtDesc(id, pageable);
        return ApiResponse.ok(PageResponse.of(entries, log -> {
            User actor = log.getActorUserId() != null ? userRepository.findById(log.getActorUserId()).orElse(null) : null;
            return new AuditEventDto(log.getId(), log.getCreatedAt(), log.getActorUserId(),
                    actor != null ? actor.getName() : null, log.getAction(), log.getDetails());
        }));
    }

    /** Module spec §10: lets the frontend reliably discover the CURRENT user's own assignment on
     *  this document, instead of scanning the full signing-route response client-side. Returns a
     *  null {@code data} (200 OK) when there is none - same "describe state, don't error on
     *  absence" convention this module already uses for /access - never another user's assignment. */
    @GetMapping("/my-assignment")
    public ApiResponse<CurrentAssignmentDto> myAssignment(@PathVariable Long id) {
        Long userId = CurrentUser.get().getId();
        SigningRoute route;
        try {
            route = routeService.getRoute(id, userId);
        } catch (NotFoundException ex) {
            return ApiResponse.ok(null);
        }
        List<SigningStep> steps = routeService.stepsOf(route.getId());
        java.util.Map<Long, SigningStep> stepById = steps.stream()
                .collect(java.util.stream.Collectors.toMap(SigningStep::getId, s -> s));
        var ownAssignment = routeService.assignmentsOf(steps.stream().map(SigningStep::getId).toList()).stream()
                .filter(a -> userId.equals(a.getUserId()))
                .findFirst();
        if (ownAssignment.isEmpty()) {
            return ApiResponse.ok(null);
        }
        SigningAssignment assignment = ownAssignment.get();
        SigningStep step = stepById.get(assignment.getStepId());
        Document document = documentService.getOrThrow(id);
        boolean actionable = route.getStatus() == SigningRouteStatus.ACTIVE
                && (assignment.getStatus() == AssignmentStatus.AVAILABLE || assignment.getStatus() == AssignmentStatus.VIEWED);
        return ApiResponse.ok(new CurrentAssignmentDto(
                assignment.getId(),
                id,
                document.getCurrentVersionId(),
                route.getId(),
                step != null ? step.getId() : null,
                step != null ? step.getStepOrder() : -1,
                assignment.getStatus(),
                assignment.isRequired(),
                assignment.getRoleCode(),
                document.getSigningDeadline(),
                actionable,
                actionable,
                actionable
        ));
    }

    @PostMapping("/signing-route")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> createRoute(
            @PathVariable Long id, @RequestBody SigningRouteDtos.CreateSigningRouteRequest request) {
        SigningRoute route = routeService.createRoute(id, request, CurrentUser.get().getId());
        return ApiResponse.ok(mapper.toResponse(route, routeService));
    }

    @GetMapping("/signing-route")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> getRoute(@PathVariable Long id) {
        return ApiResponse.ok(mapper.toResponse(routeService.getRoute(id, CurrentUser.get().getId()), routeService));
    }

    @PutMapping("/signing-route")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> updateRoute(
            @PathVariable Long id, @RequestBody SigningRouteDtos.CreateSigningRouteRequest request) {
        SigningRoute route = routeService.updateRoute(id, request, CurrentUser.get().getId());
        return ApiResponse.ok(mapper.toResponse(route, routeService));
    }

    @PostMapping("/prepare-for-signing")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> prepareForSigning(
            @PathVariable Long id, @RequestBody(required = false) SigningRouteDtos.PrepareForSigningRequest request) {
        SigningRoute route = routeService.prepareForSigning(id, request, CurrentUser.get().getId());
        return ApiResponse.ok(mapper.toResponse(route, routeService));
    }

    @PostMapping("/send-for-signing")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> sendForSigning(
            @PathVariable Long id, @RequestBody SigningRouteDtos.SendForSigningRequest request) {
        SigningRoute route = routeService.sendForSigning(id, request, CurrentUser.get().getId());
        return ApiResponse.ok(mapper.toResponse(route, routeService));
    }

    @PostMapping("/cancel-signing")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> cancelSigning(
            @PathVariable Long id, @RequestBody(required = false) SigningRouteDtos.RejectRequest request) {
        String reason = request != null ? request.reason() : null;
        SigningRoute route = routeService.cancelSigning(id, CurrentUser.get().getId(), reason);
        return ApiResponse.ok(mapper.toResponse(route, routeService));
    }

    @GetMapping("/signing-data")
    public ApiResponse<SigningRouteDtos.SigningRouteResponse> signingData(@PathVariable Long id) {
        return ApiResponse.ok(mapper.toResponse(routeService.getRoute(id, CurrentUser.get().getId()), routeService));
    }

    @PostMapping("/signatures")
    public ApiResponse<SigningRouteDtos.SignatureResponse> submitSignature(
            @PathVariable Long id, @RequestBody SigningRouteDtos.SubmitSignatureRequest request) {
        DocumentFlowSignature signature = signingService.submitOrganizationMemberSignature(id, request, CurrentUser.get().getId());
        return ApiResponse.ok(mapper.toResponse(signature));
    }

    @GetMapping("/signatures")
    public ApiResponse<List<SigningRouteDtos.SignatureResponse>> listSignatures(@PathVariable Long id) {
        return ApiResponse.ok(signingService.listSignatures(id, CurrentUser.get().getId()).stream().map(mapper::toResponse).toList());
    }

    @PostMapping("/signatures/verify-all")
    public ApiResponse<Map<Long, String>> verifyAll(@PathVariable Long id) {
        Map<Long, VerificationStatus> results = signingService.verifyAll(id, CurrentUser.get().getId());
        Map<Long, String> asStrings = new java.util.LinkedHashMap<>();
        results.forEach((k, v) -> asStrings.put(k, v.name()));
        return ApiResponse.ok(asStrings);
    }

    @PostMapping("/reject")
    public ApiResponse<Void> reject(@PathVariable Long id, @RequestBody SigningRouteDtos.RejectRequest request) {
        SigningAssignment assignment = requireOwnAssignment(id);
        boolean anyPriorSignatures = !signingService.listSignatures(id, CurrentUser.get().getId()).isEmpty();
        signingService.reject(id, assignment, request.reason(), anyPriorSignatures);
        return ApiResponse.message("Отклонено");
    }

    @PostMapping("/return-for-revision")
    public ApiResponse<Void> returnForRevision(@PathVariable Long id, @RequestBody SigningRouteDtos.RejectRequest request) {
        SigningAssignment assignment = requireOwnAssignment(id);
        signingService.reject(id, assignment, request.reason(), false);
        return ApiResponse.message("Возвращено на доработку");
    }

    private SigningAssignment requireOwnAssignment(Long documentId) {
        Long userId = CurrentUser.get().getId();
        SigningRoute route = routeService.getRoute(documentId, userId);
        return routeService.assignmentsOf(routeService.stepsOf(route.getId()).stream().map(SigningStep::getId).toList())
                .stream()
                .filter(a -> userId.equals(a.getUserId()))
                .filter(a -> a.getStatus() == AssignmentStatus.AVAILABLE || a.getStatus() == AssignmentStatus.VIEWED)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Активное задание на подписание не найдено для текущего пользователя"));
    }

    @GetMapping(value = "/signed-package", produces = "application/zip")
    public ResponseEntity<StreamingResponseBody> signedPackage(@PathVariable Long id) {
        // Genuine streaming: writeSignedPackage() writes the document + every CMS blob directly
        // into the servlet's OutputStream (via ZipOutputStream, entry by entry) - nothing is
        // buffered whole in memory here first.
        Long userId = CurrentUser.get().getId();
        StreamingResponseBody body = out -> signingService.writeSignedPackage(id, userId, out);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"document-" + id + "-signed-package.zip\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(body);
    }

    @GetMapping("/verification-report")
    public ApiResponse<Map<Long, String>> verificationReport(@PathVariable Long id) {
        return verifyAll(id);
    }
}
