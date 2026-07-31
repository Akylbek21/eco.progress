package kz.eco.storage;

import kz.eco.auth.CurrentUser;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.order.LaboratoryResultDocumentRepository;
import kz.eco.order.Order;
import kz.eco.order.OrderDocumentRepository;
import kz.eco.order.OrderPrimaryDocumentRepository;
import kz.eco.order.OrderService;
import kz.eco.order.QuarterDocumentRepository;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.EnumSet;
import java.util.Optional;

/**
 * SECURITY: {@code /api/files/documents/{fileId}} used to serve any stored file to any
 * authenticated user with zero ownership check - anyone who could see (or guess/enumerate) a
 * fileId could download protocol PDFs, signed order documents, etc. belonging to a company or
 * client they have no relationship with.
 *
 * <p>There is no single generic "owner" column on stored files (GridFS/disk metadata records a
 * free-form contextId that isn't queryable in a uniform way), so ownership is resolved the same
 * way the rest of the codebase already does it: by cross-referencing the fileId against the
 * handful of entities that are known to reference it, then re-using that entity's own controller's
 * authorization rule (protocol role-gate, order client/staff scoping). This mirrors how
 * ProtocolController/OrderService already authorize access to the same underlying files through
 * their own dedicated download endpoints - this endpoint must not be a way to route around that.
 *
 * <p>Any fileId that cannot be resolved to a known owning entity (e.g. legacy uploads, PEK/
 * normative attachments not yet covered) is conservatively denied to everyone except ADMIN, rather
 * than defaulting to "allow" - see {@link #authorize(String, User)}.
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final EnumSet<UserRole> LAB_PROTOCOL_ROLES =
            EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY);

    private final FileStorageService fileStorageService;
    private final ProtocolRepository protocolRepository;
    private final LaboratoryRepository laboratoryRepository;
    private final OrderDocumentRepository orderDocumentRepository;
    private final QuarterDocumentRepository quarterDocumentRepository;
    private final OrderPrimaryDocumentRepository orderPrimaryDocumentRepository;
    private final LaboratoryResultDocumentRepository laboratoryResultDocumentRepository;
    private final OrderService orderService;

    public FileController(FileStorageService fileStorageService,
                           ProtocolRepository protocolRepository,
                           LaboratoryRepository laboratoryRepository,
                           OrderDocumentRepository orderDocumentRepository,
                           QuarterDocumentRepository quarterDocumentRepository,
                           OrderPrimaryDocumentRepository orderPrimaryDocumentRepository,
                           LaboratoryResultDocumentRepository laboratoryResultDocumentRepository,
                           OrderService orderService) {
        this.fileStorageService = fileStorageService;
        this.protocolRepository = protocolRepository;
        this.laboratoryRepository = laboratoryRepository;
        this.orderDocumentRepository = orderDocumentRepository;
        this.quarterDocumentRepository = quarterDocumentRepository;
        this.orderPrimaryDocumentRepository = orderPrimaryDocumentRepository;
        this.laboratoryResultDocumentRepository = laboratoryResultDocumentRepository;
        this.orderService = orderService;
    }

    @GetMapping("/documents/{fileId}")
    public ResponseEntity<InputStreamResource> downloadFile(@PathVariable String fileId) throws IOException {
        User user = CurrentUser.get();
        authorize(fileId, user);

        StoredFileContent resource = fileStorageService.load(fileId);
        String filename = resource.filename();
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resource.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encodedFilename)
                .body(new InputStreamResource(resource.inputStream()));
    }

    private void authorize(String fileId, User user) {
        // 1. Protocol documents (docx/pdf/signature) - same role gate ProtocolController enforces
        //    on its own /api/protocols/{id}/download-* endpoints (LAB_PROTOCOL: ADMIN/DIRECTOR/HEAD/
        //    LABORATORY). Protocols aren't scoped per-company beyond that role gate anywhere else
        //    in the app, so this matches existing behavior rather than inventing a stricter rule.
        Optional<Protocol> owningProtocol = protocolRepository.findByDocxFileId(fileId)
                .or(() -> protocolRepository.findByPdfFileId(fileId))
                .or(() -> protocolRepository.findBySignatureFileId(fileId));
        if (owningProtocol.isPresent()) {
            requireRole(user, LAB_PROTOCOL_ROLES);
            return;
        }

        // 2. Laboratory logo (own logo or the snapshot copied onto a protocol) - a non-secret
        //    branding image that already appears on protocol PDFs shown to clients, so any
        //    authenticated user may fetch it. Conservative assumption: still requires
        //    authentication (enforced upstream by the security filter chain / CurrentUser.get()).
        if (laboratoryRepository.findByLogoFileId(fileId).isPresent()
                || protocolRepository.findByLaboratoryLogoFileId(fileId).isPresent()) {
            return;
        }

        // 3. Order-family documents (client uploads, quarterly documents, primary documents,
        //    laboratory result documents) - fileId is embedded in the stored fileUrl exactly as
        //    "/api/files/documents/{fileId}", so match on that to find the owning order, then
        //    reuse OrderService's own client/staff scoping rule.
        String selfUrl = "/api/files/documents/" + fileId;
        Optional<Order> owningOrder = orderDocumentRepository.findByFileUrl(selfUrl).map(d -> d.getOrder())
                .or(() -> quarterDocumentRepository.findByFileUrl(selfUrl).map(d -> d.getOrder()))
                .or(() -> orderPrimaryDocumentRepository.findByFileUrl(selfUrl).map(d -> d.getOrder()))
                .or(() -> laboratoryResultDocumentRepository.findByFileUrl(selfUrl).map(d -> d.getOrder()));
        if (owningOrder.isPresent()) {
            orderService.assertCanAccessOrder(owningOrder.get().getId(), user);
            return;
        }

        // 4. Unknown/unmapped file category - no queryable ownership metadata exists yet for it
        //    (e.g. normative imports, PEK attachments, ad-hoc uploads). Fail closed: only ADMIN
        //    can fetch these until that category gets its own ownership check, instead of quietly
        //    allowing any authenticated user through as the old code did.
        requireRole(user, EnumSet.of(UserRole.ADMIN));
    }

    private void requireRole(User user, EnumSet<UserRole> allowed) {
        if (user == null || user.getRole() == null || !allowed.contains(user.getRole())) {
            throw new AccessDeniedException("Недостаточно прав для доступа к файлу");
        }
    }
}
