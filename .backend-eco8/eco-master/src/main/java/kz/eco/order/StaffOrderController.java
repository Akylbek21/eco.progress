package kz.eco.order;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.order.dto.*;
import kz.eco.user.SecurityExpressions;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/staff/orders")
@PreAuthorize(SecurityExpressions.STAFF)
public class StaffOrderController {

    private final OrderService orderService;

    public StaffOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ApiResponse<OrderResponse> createOrder(@Valid @RequestBody StaffCreateOrderRequest request) {
        return ApiResponse.ok(orderService.createOrderByStaff(request, CurrentUser.get()),
                "Заявка создана сотрудником");
    }

    @GetMapping
    public ApiResponse<List<OrderResponse>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String businessCompanyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String contractType,
            @RequestParam(required = false) Long managerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {
        return ApiResponse.ok(orderService.findAllOrders(q, businessCompanyId, status,
                paymentStatus, contractType, managerId, dateFrom, dateTo));
    }

    @GetMapping("/{id}")
    public ApiResponse<OrderResponse> get(@PathVariable String id) {
        return ApiResponse.ok(orderService.getOrderById(id, CurrentUser.get()));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<OrderResponse> updateStatus(@PathVariable String id,
                                                    @Valid @RequestBody UpdateStatusRequest request) {
        return ApiResponse.ok(orderService.updateStatus(id, request.status(), CurrentUser.get()),
                "Статус заявки обновлён");
    }

    @PatchMapping("/{id}/ecology-status")
    @PreAuthorize("hasAnyRole('ADMIN','ECOLOGIST')")
    public ApiResponse<OrderResponse> updateEcologyStatus(@PathVariable String id,
                                                           @Valid @RequestBody UpdateEcologyStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateEcologyStatus(id, request.ecologyStatus(), request.comment(), CurrentUser.get()),
                "Статус обновлен");
    }

    @PatchMapping("/{id}/laboratory-status")
    @PreAuthorize("hasAnyRole('ADMIN','LABORATORY')")
    public ApiResponse<OrderResponse> updateLaboratoryStatus(@PathVariable String id,
                                                              @Valid @RequestBody UpdateLaboratoryStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateLaboratoryStatus(id, request.laboratoryStatus(), request.comment(), CurrentUser.get()),
                "Статус обновлен");
    }

    @PatchMapping("/{id}/assign")
    public ApiResponse<OrderResponse> assignStaff(@PathVariable String id,
                                                   @Valid @RequestBody AssignStaffRequest request) {
        return ApiResponse.ok(orderService.assignStaff(id, request.role(), request.userId(), CurrentUser.get()),
                "Сотрудник назначен");
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<CommentResponse> addComment(@PathVariable String id,
                                                    @Valid @RequestBody AddCommentRequest request) {
        return ApiResponse.ok(
                orderService.addComment(id, null, request.text(), request.visibility(), CurrentUser.get()),
                "Комментарий добавлен");
    }

    @PostMapping(value = "/{id}/documents", consumes = "multipart/form-data")
    public ApiResponse<DocumentResponse> uploadDocument(@PathVariable String id,
                                                         @RequestParam("file") MultipartFile file,
                                                         @RequestParam(value = "type", required = false) String type,
                                                         @RequestParam(value = "title", required = false) String title,
                                                         @RequestParam(value = "name", required = false) String name,
                                                         @RequestParam(value = "sendToClient", required = false) Boolean sendToClient,
                                                         @RequestParam(value = "needsSignature", required = false) Boolean needsSignature,
                                                         @RequestParam(value = "needsClientResponse", required = false) Boolean needsClientResponse,
                                                         @RequestParam(value = "comment", required = false) String staffComment,
                                                         @RequestParam(value = "dueDate", required = false) String dueDate) throws IOException {
        return ApiResponse.ok(
                orderService.uploadDocument(id, file, type, sendToClient, needsSignature,
                        needsClientResponse, staffComment, dueDate, title, name, CurrentUser.get()),
                "Документ загружен");
    }

    @PostMapping("/{id}/contract-and-invoice")
    public ApiResponse<OrderResponse> sendContractAndInvoice(@PathVariable String id,
                                                              @Valid @RequestBody SendContractRequest request) {
        return ApiResponse.ok(orderService.sendContractAndInvoice(id, request, CurrentUser.get()),
                "Договор и счёт отправлены");
    }

    @PatchMapping("/{id}/contract-status")
    public ApiResponse<OrderResponse> updateContractStatus(@PathVariable String id,
                                                            @Valid @RequestBody UpdateContractStatusRequest request) {
        return ApiResponse.ok(orderService.updateContractStatus(id, request.crmContractStatus(), CurrentUser.get()),
                "Статус договора обновлён");
    }

    @PatchMapping("/{orderId}/quarters/{quarterId}/work-status")
    public ApiResponse<QuarterResponse> updateQuarterWorkStatus(
            @PathVariable String orderId, @PathVariable Long quarterId,
            @Valid @RequestBody UpdateQuarterWorkStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateQuarterWorkStatus(orderId, quarterId,
                        request.workStatus(), request.comment(), CurrentUser.get()),
                "Статус работ обновлён");
    }

    @PostMapping(value = "/{orderId}/quarters/{quarterId}/documents", consumes = "multipart/form-data")
    public ApiResponse<QuarterDocumentResponse> uploadQuarterDoc(
            @PathVariable String orderId, @PathVariable Long quarterId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "type", required = false) String type) throws IOException {
        return ApiResponse.ok(
                orderService.uploadQuarterDocument(orderId, quarterId, file, type, CurrentUser.get()),
                "Документ загружен");
    }

    @PostMapping("/{orderId}/quarters/{quarterId}/results")
    public ApiResponse<QuarterResultResponse> addQuarterResult(
            @PathVariable String orderId, @PathVariable Long quarterId,
            @Valid @RequestBody AddQuarterResultRequest request) {
        return ApiResponse.ok(
                orderService.addQuarterResult(orderId, quarterId,
                        request.title(), request.description(), request.resultType(), CurrentUser.get()),
                "Результат добавлен");
    }

    @PostMapping("/{orderId}/quarters/{quarterId}/comments")
    public ApiResponse<CommentResponse> addQuarterComment(
            @PathVariable String orderId, @PathVariable Long quarterId,
            @Valid @RequestBody AddCommentRequest request) {
        return ApiResponse.ok(
                orderService.addQuarterComment(orderId, quarterId,
                        request.text(), request.visibility(), CurrentUser.get()),
                "Комментарий добавлен");
    }

    @PostMapping("/{orderId}/quarters/{quarterId}/payments")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN')")
    public ApiResponse<Void> addQuarterPayment(
            @PathVariable String orderId, @PathVariable Long quarterId,
            @Valid @RequestBody AddQuarterPaymentRequest request) {
        orderService.addQuarterPayment(orderId, quarterId,
                request.amount(), request.method(), request.comment(), CurrentUser.get());
        return ApiResponse.message("Оплата зафиксирована");
    }

    @PostMapping("/{orderId}/complete-annual")
    public ApiResponse<OrderResponse> completeAnnual(@PathVariable String orderId) {
        return ApiResponse.ok(orderService.completeAnnual(orderId, CurrentUser.get()),
                "Годовое обслуживание завершено");
    }

    // ── Primary documents ──

    @PostMapping("/{id}/primary-documents")
    public ApiResponse<PrimaryDocumentResponse> requestPrimaryDocument(
            @PathVariable String id,
            @Valid @RequestBody RequestPrimaryDocumentRequest request) {
        return ApiResponse.ok(
                orderService.requestPrimaryDocument(id, request, CurrentUser.get()),
                "Документ запрошен");
    }

    @PostMapping("/{id}/primary-documents/batch")
    public ApiResponse<List<PrimaryDocumentResponse>> batchRequestPrimaryDocuments(
            @PathVariable String id,
            @Valid @RequestBody BatchRequestPrimaryDocumentsRequest request) {
        return ApiResponse.ok(
                orderService.batchRequestPrimaryDocuments(id, request, CurrentUser.get()),
                "Документы запрошены");
    }

    @PostMapping("/{id}/documents/{documentId}/send-to-client")
    public ApiResponse<DocumentResponse> sendDocumentToClient(
            @PathVariable String id, @PathVariable Long documentId,
            @Valid @RequestBody SendDocumentToClientRequest request) {
        return ApiResponse.ok(
                orderService.sendDocumentToClient(id, documentId, request, CurrentUser.get()),
                "Документ отправлен клиенту");
    }

    @PatchMapping("/{id}/payment")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN','MANAGER')")
    public ApiResponse<OrderResponse> updatePayment(@PathVariable String id,
                                                   @Valid @RequestBody UpdateOrderPaymentRequest request) {
        return ApiResponse.ok(
                orderService.updateOrderPayment(id, request, CurrentUser.get()),
                "Статус оплаты обновлён");
    }

    @DeleteMapping("/{id}/primary-documents/{docId}")
    public ApiResponse<Void> deletePrimaryDocument(
            @PathVariable String id, @PathVariable Long docId) {
        orderService.deletePrimaryDocument(id, docId, CurrentUser.get());
        return ApiResponse.message("Запрос на документ удалён");
    }

    @PatchMapping("/{id}/primary-documents/{docId}")
    public ApiResponse<PrimaryDocumentResponse> updatePrimaryDocumentStatus(
            @PathVariable String id, @PathVariable Long docId,
            @Valid @RequestBody UpdatePrimaryDocumentStatusRequest request) {
        return ApiResponse.ok(
                orderService.updatePrimaryDocumentStatus(id, docId, request, CurrentUser.get()),
                "Статус документа обновлён");
    }

    // ── Laboratory primary documents ──

    @PostMapping("/{id}/laboratory/primary-documents")
    public ApiResponse<PrimaryDocumentResponse> requestLaboratoryPrimaryDocument(
            @PathVariable String id,
            @Valid @RequestBody RequestPrimaryDocumentRequest request) {
        return ApiResponse.ok(
                orderService.requestLaboratoryPrimaryDocument(id, request, CurrentUser.get()),
                "Лабораторный документ запрошен");
    }

    @PatchMapping("/{id}/laboratory/primary-documents/{docId}")
    public ApiResponse<PrimaryDocumentResponse> updateLaboratoryPrimaryDocumentStatus(
            @PathVariable String id, @PathVariable Long docId,
            @Valid @RequestBody UpdatePrimaryDocumentStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateLaboratoryPrimaryDocumentStatus(id, docId, request, CurrentUser.get()),
                "Статус лаб. документа обновлён");
    }

    // ── Measurement agreement ──

    @PatchMapping("/{id}/laboratory/measurement")
    public ApiResponse<MeasurementAgreementResponse> saveMeasurementAgreement(
            @PathVariable String id,
            @Valid @RequestBody SaveMeasurementAgreementRequest request) {
        return ApiResponse.ok(
                orderService.saveMeasurementAgreement(id, request, CurrentUser.get()),
                "Согласование сохранено");
    }

    @PostMapping("/{id}/laboratory/measurement/send")
    public ApiResponse<MeasurementAgreementResponse> sendMeasurementAgreement(
            @PathVariable String id) {
        return ApiResponse.ok(
                orderService.sendMeasurementAgreement(id, CurrentUser.get()),
                "Согласование отправлено");
    }

    @PatchMapping("/{id}/laboratory/measurement/status")
    public ApiResponse<MeasurementAgreementResponse> updateMeasurementAgreementStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateMeasurementStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateMeasurementAgreementStatus(id, request, CurrentUser.get()),
                "Статус согласования обновлён");
    }

    // ── Lab results ──

    @PostMapping("/{id}/laboratory/results")
    public ApiResponse<LabResultDocumentResponse> uploadLabResult(
            @PathVariable String id,
            @Valid @RequestBody UploadLabResultRequest request) {
        return ApiResponse.ok(
                orderService.uploadLabResult(id, request, CurrentUser.get()),
                "Результат загружен");
    }

    @PatchMapping("/{id}/laboratory/results/{docId}")
    public ApiResponse<LabResultDocumentResponse> updateLabResultStatus(
            @PathVariable String id, @PathVariable Long docId,
            @Valid @RequestBody UpdateLabResultStatusRequest request) {
        return ApiResponse.ok(
                orderService.updateLabResultStatus(id, docId, request, CurrentUser.get()),
                "Статус результата обновлён");
    }
}
