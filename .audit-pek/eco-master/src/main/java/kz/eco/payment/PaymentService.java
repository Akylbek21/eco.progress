package kz.eco.payment;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.payment.dto.DebtResponse;
import kz.eco.payment.dto.PaymentResponse;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentTransactionRepository transactionRepository;
    private final DebtRepository debtRepository;

    public PaymentService(PaymentRepository paymentRepository,
                          PaymentTransactionRepository transactionRepository,
                          DebtRepository debtRepository) {
        this.paymentRepository = paymentRepository;
        this.transactionRepository = transactionRepository;
        this.debtRepository = debtRepository;
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> findAllPayments() {
        return paymentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(PaymentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> findByClientEmail(String email) {
        return paymentRepository.findByClientEmailIgnoreCaseOrderByCreatedAtDesc(email).stream()
                .map(PaymentResponse::from).toList();
    }

    @Transactional
    public PaymentResponse addPartialPayment(Long paymentId, BigDecimal amount, String method, String comment, User actor) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("Платёж не найден"));
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Сумма должна быть больше нуля");
        }

        PaymentTransaction tx = new PaymentTransaction();
        tx.setPaymentId(paymentId);
        tx.setContractId(payment.getContractId());
        tx.setAmount(amount);
        tx.setMethod(method != null ? method : "Банковский перевод");
        tx.setPaidAt(LocalDate.now());
        tx.setComment(comment);
        tx.setCreatedByUser(actor);
        tx.setCreatedByName(actor.getName());
        transactionRepository.save(tx);

        payment.setPaidAmount(payment.getPaidAmount().add(amount));
        payment.setRemainingAmount(payment.getTotalAmount().subtract(payment.getPaidAmount()).max(BigDecimal.ZERO));
        payment.setLastPaymentDate(LocalDate.now());
        payment.recalcStatus();
        paymentRepository.save(payment);

        return PaymentResponse.from(payment);
    }

    @Transactional
    public PaymentResponse markPaid(Long paymentId, User actor) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("Платёж не найден"));

        payment.setPaidAmount(payment.getTotalAmount());
        payment.setRemainingAmount(BigDecimal.ZERO);
        payment.setPaymentStatus(kz.eco.order.PaymentStatus.paid);
        payment.setLastPaymentDate(LocalDate.now());
        paymentRepository.save(payment);

        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public List<DebtResponse> findAllDebts() {
        return debtRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(DebtResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<DebtResponse> findDebtsByClientEmail(String email) {
        return debtRepository.findByClientEmailIgnoreCaseAndStatusNotOrderByCreatedAtDesc(email, DebtStatus.closed)
                .stream().map(DebtResponse::from).toList();
    }

    @Transactional
    public DebtResponse updateDebtComment(Long id, String comment) {
        Debt debt = debtRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задолженность не найдена"));
        debt.setComment(comment);
        debtRepository.save(debt);
        return DebtResponse.from(debt);
    }

    @Transactional
    public DebtResponse closeDebt(Long id) {
        Debt debt = debtRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задолженность не найдена"));
        debt.setStatus(DebtStatus.closed);
        debt.setClosedAt(LocalDateTime.now());
        debtRepository.save(debt);
        return DebtResponse.from(debt);
    }

    @Transactional
    public PaymentResponse updatePaymentDetails(Long paymentId,
                                                 kz.eco.payment.dto.UpdatePaymentDetailsRequest req, User actor) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("Платёж не найден"));

        if (req.invoiceNumber() != null) payment.setInvoiceNumber(req.invoiceNumber());
        if (req.serviceName() != null) payment.setServiceName(req.serviceName());
        if (req.totalAmount() != null) {
            payment.setTotalAmount(req.totalAmount());
            payment.setRemainingAmount(req.totalAmount().subtract(payment.getPaidAmount()).max(java.math.BigDecimal.ZERO));
        }
        if (req.paymentMethod() != null) payment.setPaymentMethod(req.paymentMethod());
        if (req.paymentStatus() != null) {
            payment.setPaymentStatus(kz.eco.order.PaymentStatus.valueOf(req.paymentStatus()));
        }
        if (req.invoiceDate() != null) payment.setInvoiceDate(req.invoiceDate());
        if (req.dueDate() != null) payment.setDueDate(req.dueDate());
        if (req.comment() != null) payment.setComment(req.comment());

        payment.recalcStatus();
        paymentRepository.save(payment);

        return PaymentResponse.from(payment);
    }
}
