package kz.eco.mail;

import kz.eco.order.Order;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MailNotificationService {

    private final EmailOutboxService outbox;
    private final EmailRecipientResolver recipients;

    public MailNotificationService(EmailOutboxService outbox, EmailRecipientResolver recipients) {
        this.outbox = outbox;
        this.recipients = recipients;
    }

    public void onOrderCreated(Order order) {
        String body = "Клиент создал заявку " + order.getId() + ": " + order.getServiceName()
                + ". Контакт: " + order.getContactPerson() + ", тел. " + order.getPhone();
        enqueueStaff(order, EmailEvent.ORDER_CREATED, "Новая заявка " + order.getId(), body);
    }

    public void onContractSent(Order order) {
        enqueueClient(order, EmailEvent.CONTRACT_SENT,
                "Договор и счёт по заявке " + order.getId(),
                "По заявке " + order.getId() + " отправлены договор и счёт на оплату. Войдите в личный кабинет.");
    }

    public void onContractSigned(Order order) {
        String body = "Клиент подписал договор по заявке " + order.getId() + ".";
        for (String email : recipients.managerAndAccountantEmails(order)) {
            outbox.enqueue(email, "Клиент подписал договор", body, EmailEvent.CONTRACT_SIGNED, order.getId());
        }
        if (recipients.managerAndAccountantEmails(order).isEmpty()) {
            enqueueStaff(order, EmailEvent.CONTRACT_SIGNED, "Клиент подписал договор", body);
        }
    }

    public void onDocumentSent(Order order, String documentName, boolean needsSignature) {
        EmailEvent event = needsSignature ? EmailEvent.DOCUMENT_SIGNATURE_REQUIRED : EmailEvent.DOCUMENT_SENT;
        String subject = needsSignature
                ? "Документ отправлен на подпись"
                : "Новый документ по заявке";
        String body = needsSignature
                ? "По заявке " + order.getId() + " документ «" + documentName + "» ожидает вашей ЭЦП."
                : "По заявке " + order.getId() + " сотрудник отправил документ: «" + documentName + "».";
        enqueueClient(order, event, subject + " (" + order.getId() + ")", body);
    }

    public void onDocumentSigned(Order order, String documentName) {
        String body = "Клиент подписал документ «" + documentName + "» по заявке " + order.getId() + ".";
        enqueueStaff(order, EmailEvent.DOCUMENT_SIGNED, "Документ подписан клиентом", body);
    }

    public void onPrimaryDocsRequested(Order order, String documentName) {
        enqueueClient(order, EmailEvent.PRIMARY_DOCS_REQUESTED,
                "Запрос документов по заявке " + order.getId(),
                "По заявке " + order.getId() + " запрошен документ: «" + documentName + "». Загрузите его в личном кабинете.");
    }

    public void onPrimaryDocsReview(Order order) {
        enqueueStaff(order, EmailEvent.PRIMARY_DOCS_REVIEW,
                "Первичные документы на проверке",
                "Клиент отправил первичные документы на проверку по заявке " + order.getId() + ".");
    }

    public void onClientComment(Order order, String preview) {
        enqueueStaff(order, EmailEvent.CLIENT_COMMENT,
                "Комментарий клиента по заявке " + order.getId(),
                "Клиент оставил комментарий: " + preview);
    }

    public void onStaffCommentToClient(Order order, String preview) {
        enqueueClient(order, EmailEvent.STAFF_COMMENT_TO_CLIENT,
                "Сообщение по заявке " + order.getId(),
                "Сотрудник написал: " + preview);
    }

    public void onPaymentInvoice(Order order) {
        enqueueClient(order, EmailEvent.PAYMENT_INVOICE,
                "Счёт по заявке " + order.getId(),
                "По заявке " + order.getId() + " выставлен счёт. Сумма: "
                        + (order.getPaymentAmount() != null ? order.getPaymentAmount() + " ₸" : "уточняется"));
    }

    public void onPaymentConfirmed(Order order) {
        enqueueClient(order, EmailEvent.PAYMENT_CONFIRMED,
                "Оплата подтверждена",
                "Оплата по заявке " + order.getId() + " подтверждена.");
    }

    private void enqueueClient(Order order, EmailEvent event, String subject, String body) {
        outbox.enqueue(recipients.clientEmail(order), subject, body, event, order.getId());
    }

    private void enqueueStaff(Order order, EmailEvent event, String subject, String body) {
        List<String> emails = recipients.staffEmails(order);
        if (emails.isEmpty()) {
            return;
        }
        for (String email : emails) {
            outbox.enqueue(email, subject, body, event, order.getId());
        }
    }
}
