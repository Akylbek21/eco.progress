package kz.eco.order;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.order.dto.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/client")
@PreAuthorize("hasAnyRole('CLIENT','MANAGER','ADMIN')")
public class ClientOrderController {

    private final OrderService orderService;

    public ClientOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/orders")
    public ApiResponse<List<OrderResponse>> list() {
        return ApiResponse.ok(orderService.findClientOrders(CurrentUser.get()));
    }

    @PostMapping("/orders")
    public ApiResponse<OrderResponse> create(@Valid @RequestBody CreateOrderRequest request) {
        return ApiResponse.ok(orderService.createOrder(request, CurrentUser.get()), "Заявка создана");
    }

    @GetMapping("/orders/{id}")
    public ApiResponse<OrderResponse> get(@PathVariable String id) {
        return ApiResponse.ok(orderService.getOrderById(id, CurrentUser.get()));
    }

    @PostMapping("/orders/{id}/comments")
    public ApiResponse<CommentResponse> addComment(@PathVariable String id,
                                                    @Valid @RequestBody AddCommentRequest request) {
        return ApiResponse.ok(
                orderService.addComment(id, null, request.text(), CommentVisibility.client, CurrentUser.get()),
                "Комментарий добавлен");
    }

    @PostMapping(value = "/orders/{id}/documents", consumes = "multipart/form-data")
    public ApiResponse<DocumentResponse> uploadDocument(@PathVariable String id,
                                                         @RequestParam("file") MultipartFile file,
                                                         @RequestParam(value = "type", required = false) String type) throws IOException {
        return ApiResponse.ok(orderService.uploadDocument(id, file, type, CurrentUser.get()), "Документ загружен");
    }

    @PostMapping("/orders/{id}/contract/sign")
    public ApiResponse<OrderResponse> signContract(@PathVariable String id,
                                                    @RequestBody(required = false) SignContractRequest request) {
        return ApiResponse.ok(orderService.signContract(id, request, CurrentUser.get()),
                "Договор подписан электронной подписью");
    }

    @PostMapping(value = "/orders/{id}/documents/{documentId}/respond",
            consumes = {"application/json", "multipart/form-data"})
    public ApiResponse<DocumentResponse> respondToDocument(
            @PathVariable String id, @PathVariable Long documentId,
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "signedCms", required = false) String signedCms,
            @RequestParam(value = "signerSubject", required = false) String signerSubject,
            @RequestParam(value = "comment", required = false) String comment,
            @RequestBody(required = false) DocumentRespondRequest body) {
        DocumentRespondRequest request = body != null ? body : new DocumentRespondRequest(
                action != null ? action : "",
                signedCms,
                signerSubject,
                comment
        );
        if (request.action() == null || request.action().isBlank()) {
            throw new kz.eco.common.exception.BadRequestException("Укажите action");
        }
        return ApiResponse.ok(
                orderService.respondToDocument(id, documentId, request, CurrentUser.get()),
                "Ответ по документу сохранён");
    }

    @PostMapping("/orders/{id}/pay")
    public ApiResponse<OrderResponse> pay(@PathVariable String id,
                                           @RequestBody(required = false) PayOrderRequest request) {
        String method = request != null ? request.paymentMethod() : null;
        return ApiResponse.ok(orderService.payOrder(id, method, CurrentUser.get()), "Оплата прошла");
    }

    @PostMapping(value = "/orders/{id}/agreements/{documentId}/responses",
            consumes = {"multipart/form-data", "application/json"})
    public ApiResponse<DocumentResponse> respondToAgreement(
            @PathVariable String id, @PathVariable Long documentId,
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "comment", required = false) String comment,
            @RequestParam(value = "signedCms", required = false) String signedCms,
            @RequestParam(value = "signerSubject", required = false) String signerSubject,
            @RequestBody(required = false) AgreementResponseRequest body) {
        String resolvedAction = action != null && !action.isBlank()
                ? action
                : body != null ? body.action() : null;
        String resolvedComment = comment != null ? comment : body != null ? body.comment() : null;
        String resolvedCms = signedCms != null ? signedCms : body != null ? body.signedCms() : null;
        String resolvedSubject = signerSubject != null ? signerSubject : body != null ? body.signerSubject() : null;
        if (resolvedAction == null || resolvedAction.isBlank()) {
            throw new kz.eco.common.exception.BadRequestException("Укажите action");
        }
        AgreementResponseRequest request = new AgreementResponseRequest(
                resolvedAction, resolvedComment, resolvedCms, resolvedSubject);
        return ApiResponse.ok(
                orderService.respondToAgreement(id, documentId, request, CurrentUser.get()),
                "Ответ по согласованию сохранён");
    }

    @GetMapping("/orders/{orderId}/quarters")
    public ApiResponse<List<QuarterResponse>> quarters(@PathVariable String orderId) {
        return ApiResponse.ok(orderService.getQuarters(orderId, CurrentUser.get()));
    }

    @GetMapping("/orders/{orderId}/quarters/{quarterId}")
    public ApiResponse<QuarterResponse> quarterDetail(@PathVariable String orderId,
                                                       @PathVariable Long quarterId) {
        return ApiResponse.ok(orderService.getQuarterDetail(orderId, quarterId, CurrentUser.get()));
    }

    @PostMapping(value = "/orders/{orderId}/quarters/{quarterId}/documents", consumes = "multipart/form-data")
    public ApiResponse<QuarterDocumentResponse> uploadQuarterDoc(@PathVariable String orderId,
                                                                   @PathVariable Long quarterId,
                                                                   @RequestParam("file") MultipartFile file,
                                                                   @RequestParam(value = "type", required = false) String type) throws IOException {
        return ApiResponse.ok(
                orderService.uploadQuarterDocument(orderId, quarterId, file, type, CurrentUser.get()),
                "Документ загружен");
    }

    @PostMapping("/orders/{orderId}/quarters/{quarterId}/comments")
    public ApiResponse<CommentResponse> quarterComment(@PathVariable String orderId,
                                                        @PathVariable Long quarterId,
                                                        @Valid @RequestBody AddCommentRequest request) {
        return ApiResponse.ok(
                orderService.addQuarterComment(orderId, quarterId, request.text(),
                        CommentVisibility.client, CurrentUser.get()),
                "Комментарий добавлен");
    }

    // ── Primary documents ──

    @PostMapping("/orders/{id}/primary-documents/{docId}")
    public ApiResponse<PrimaryDocumentResponse> uploadPrimaryDocument(
            @PathVariable String id, @PathVariable Long docId,
            @Valid @RequestBody UploadPrimaryDocumentRequest request) {
        return ApiResponse.ok(
                orderService.uploadPrimaryDocument(id, docId, request, CurrentUser.get()),
                "Документ загружен");
    }

    @PostMapping(value = "/orders/{id}/primary-documents/{docId}/upload", consumes = "multipart/form-data")
    public ApiResponse<PrimaryDocumentResponse> uploadPrimaryDocumentMultipart(
            @PathVariable String id, @PathVariable Long docId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "comment", required = false) String comment) throws IOException {
        return ApiResponse.ok(
                orderService.uploadPrimaryDocumentFile(id, docId, file, comment, CurrentUser.get()),
                "Документ загружен");
    }

    @DeleteMapping("/orders/{id}/primary-documents/{docId}/file")
    public ApiResponse<Void> deletePrimaryDocumentFile(
            @PathVariable String id, @PathVariable Long docId) {
        orderService.deletePrimaryDocumentFile(id, docId, CurrentUser.get());
        return ApiResponse.message("Файл удалён");
    }

    @PostMapping("/orders/{id}/primary-documents/review")
    public ApiResponse<Void> sendPrimaryDocumentsForReview(
            @PathVariable String id,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String clientComment = body != null ? body.get("clientComment") : null;
        orderService.sendPrimaryDocumentsForReview(id, clientComment, CurrentUser.get());
        return ApiResponse.message("Документы отправлены на проверку");
    }

    @PostMapping("/orders/{id}/primary-documents/{docId}/review")
    public ApiResponse<Void> sendPrimaryDocumentForReview(
            @PathVariable String id, @PathVariable Long docId,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String clientComment = body != null ? body.get("clientComment") : null;
        orderService.sendPrimaryDocumentForReview(id, docId, clientComment, CurrentUser.get());
        return ApiResponse.message("Документ отправлен на проверку");
    }

    // ── Laboratory primary documents ──

    @PostMapping("/orders/{id}/laboratory/primary-documents/{docId}")
    public ApiResponse<PrimaryDocumentResponse> uploadLaboratoryPrimaryDocument(
            @PathVariable String id, @PathVariable Long docId,
            @Valid @RequestBody UploadPrimaryDocumentRequest request) {
        return ApiResponse.ok(
                orderService.uploadLaboratoryPrimaryDocument(id, docId, request, CurrentUser.get()),
                "Лабораторный документ загружен");
    }

    // ── Measurement agreement ──

    @PostMapping("/orders/{id}/laboratory/measurement/respond")
    public ApiResponse<MeasurementAgreementResponse> respondToMeasurementAgreement(
            @PathVariable String id,
            @Valid @RequestBody RespondMeasurementRequest request) {
        return ApiResponse.ok(
                orderService.respondToMeasurementAgreement(id, request, CurrentUser.get()),
                "Ответ на согласование отправлен");
    }
}
