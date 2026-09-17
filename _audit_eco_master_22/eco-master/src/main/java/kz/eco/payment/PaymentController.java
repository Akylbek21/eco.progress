package kz.eco.payment;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.eco.payment.dto.DebtResponse;
import kz.eco.payment.dto.PartialPaymentRequest;
import kz.eco.payment.dto.PaymentResponse;
import kz.eco.payment.dto.UpdateDebtCommentRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class PaymentController {

    private final PaymentService paymentService;
    private final kz.eco.client.ClientRepository clientRepository;

    public PaymentController(PaymentService paymentService,
                             kz.eco.client.ClientRepository clientRepository) {
        this.paymentService = paymentService;
        this.clientRepository = clientRepository;
    }

    private String resolveClientEmail(User user) {
        return clientRepository.findByUserId(user.getId())
                .map(c -> c.getEmail())
                .orElse(user.getEmail());
    }

    @GetMapping("/api/staff/payments")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')")
    public ApiResponse<List<PaymentResponse>> staffPayments() {
        return ApiResponse.ok(paymentService.findAllPayments());
    }

    @PostMapping("/api/staff/payments/{paymentId}/partial")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN')")
    public ApiResponse<PaymentResponse> addPartialPayment(@PathVariable Long paymentId,
                                                           @Valid @RequestBody PartialPaymentRequest request) {
        return ApiResponse.ok(
                paymentService.addPartialPayment(paymentId, request.amount(), request.method(),
                        request.comment(), CurrentUser.get()),
                "Частичная оплата зафиксирована");
    }

    @PostMapping("/api/staff/payments/{paymentId}/mark-paid")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN')")
    public ApiResponse<PaymentResponse> markPaid(@PathVariable Long paymentId) {
        return ApiResponse.ok(paymentService.markPaid(paymentId, CurrentUser.get()),
                "Платёж отмечен как оплаченный");
    }

    @GetMapping("/api/staff/debts")
    @PreAuthorize("hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')")
    public ApiResponse<List<DebtResponse>> staffDebts() {
        return ApiResponse.ok(paymentService.findAllDebts());
    }

    @PatchMapping("/api/staff/debts/{id}/comment")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN','ACCOUNTANT')")
    public ApiResponse<DebtResponse> updateDebtComment(@PathVariable Long id,
                                                        @RequestBody UpdateDebtCommentRequest request) {
        return ApiResponse.ok(paymentService.updateDebtComment(id, request.comment()),
                "Комментарий обновлён");
    }

    @PostMapping("/api/staff/debts/{id}/close")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN')")
    public ApiResponse<DebtResponse> closeDebt(@PathVariable Long id) {
        return ApiResponse.ok(paymentService.closeDebt(id), "Задолженность закрыта");
    }

    @PatchMapping("/api/staff/payments/{paymentId}")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN','MANAGER')")
    public ApiResponse<PaymentResponse> updatePaymentDetails(
            @PathVariable Long paymentId,
            @Valid @RequestBody kz.eco.payment.dto.UpdatePaymentDetailsRequest request) {
        return ApiResponse.ok(
                paymentService.updatePaymentDetails(paymentId, request, CurrentUser.get()),
                "Платёж обновлён");
    }

    @GetMapping("/api/client/payments")
    @PreAuthorize("hasRole('CLIENT')")
    public ApiResponse<List<PaymentResponse>> clientPayments() {
        return ApiResponse.ok(paymentService.findByClientEmail(resolveClientEmail(CurrentUser.get())));
    }

    @GetMapping("/api/client/debts")
    @PreAuthorize("hasRole('CLIENT')")
    public ApiResponse<List<DebtResponse>> clientDebts() {
        return ApiResponse.ok(paymentService.findDebtsByClientEmail(resolveClientEmail(CurrentUser.get())));
    }
}
