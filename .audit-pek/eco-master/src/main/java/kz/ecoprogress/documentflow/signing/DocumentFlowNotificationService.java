package kz.ecoprogress.documentflow.signing;

import kz.eco.mail.EmailEvent;
import kz.eco.mail.EmailOutboxService;
import kz.eco.notification.NotificationService;
import kz.ecoprogress.documentflow.document.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Notification fan-out for send-for-signing. ORGANIZATION_MEMBER assignments go through the
 * existing in-app NotificationService. EXTERNAL/COUNTERPARTY_REPRESENTATIVE invitations go through
 * the existing {@link EmailOutboxService} - module spec §21: real outbox-based delivery (commit-
 * then-send, real SMTP via EmailOutboxProcessor, retry/attempt-count/delivery-status already built
 * into that pipeline), using the {@link EmailEvent#DOCUMENT_SIGNATURE_REQUIRED} event that already
 * existed there (an earlier version of this class incorrectly assumed no matching event existed
 * and only logged the invitation - see git history for that TODO-RECONCILE comment, now resolved).
 */
@Service
public class DocumentFlowNotificationService {

    private static final Logger log = LoggerFactory.getLogger(DocumentFlowNotificationService.class);

    private final NotificationService notificationService;
    private final EmailOutboxService emailOutboxService;
    private final DocumentFlowMailProperties mailProperties;

    public DocumentFlowNotificationService(NotificationService notificationService,
                                            EmailOutboxService emailOutboxService,
                                            DocumentFlowMailProperties mailProperties) {
        this.notificationService = notificationService;
        this.emailOutboxService = emailOutboxService;
        this.mailProperties = mailProperties;
    }

    /** Fired once the signing route completes and the document status flips to SIGNED - the
     *  author otherwise has no way to learn this happened besides polling the document list. */
    public void notifyAuthorOfCompletion(Document document) {
        if (document.getAuthorUserId() == null) {
            return;
        }
        notificationService.notify(
                document.getAuthorUserId(),
                null,
                null,
                "Документ подписан",
                "Документ \"" + safe(document.getTitle()) + "\" подписан всеми участниками маршрута",
                "df_document_signed");
    }

    /** Fired when a signer rejects (either RETURNED_FOR_REVISION or a hard REJECTED, depending on
     *  whether other signatures already existed) - see SigningService.reject. */
    public void notifyAuthorOfRejection(Document document, String reason) {
        if (document.getAuthorUserId() == null) {
            return;
        }
        notificationService.notify(
                document.getAuthorUserId(),
                null,
                null,
                "Документ отклонён",
                "Документ \"" + safe(document.getTitle()) + "\" отклонён подписантом"
                        + (reason != null && !reason.isBlank() ? ": " + reason : ""),
                "df_document_rejected");
    }

    public void notifyOrganizationMember(SigningAssignment assignment, Document document) {
        if (assignment.getUserId() == null) {
            return;
        }
        notificationService.notify(
                assignment.getUserId(),
                null,
                null,
                "Требуется подписание документа",
                "Вам необходимо подписать документ \"" + safe(document.getTitle()) + "\"",
                // kz.eco.notification.Notification.type is varchar(20) - stays within that limit
                "df_signing_required");
    }

    /** Module spec §21: real delivery via the existing SMTP outbox, not just a log line.
     *  Deliberately never logs the raw token (only its presence/expiry) - the link itself,
     *  containing the token, only ever goes into the queued email body, never a log line. */
    public void sendExternalInvitation(SigningAssignment assignment, String rawToken, Document document) {
        log.info("Document flow: signing invitation queued for assignment {} (email={}, expiresAt={}); "
                        + "token intentionally not logged, only its presence",
                assignment.getId(), assignment.getEmail(), assignment.getInvitationExpiresAt());
        if (assignment.getEmail() == null || assignment.getEmail().isBlank()) {
            return;
        }
        String link = mailProperties.getPublicSigningBaseUrl() + "/" + rawToken;
        String subject = "Требуется подпись документа: " + safe(document.getTitle());
        String body = "Здравствуйте" + (assignment.getSignerFullName() != null ? ", " + assignment.getSignerFullName() : "") + "!\n\n"
                + "Вас пригласили подписать документ \"" + safe(document.getTitle()) + "\""
                + (document.getDocumentNumber() != null ? " (№ " + document.getDocumentNumber() + ")" : "") + "\n"
                + "от организации: " + safe(assignment.getOrganizationName()) + "\n"
                + (assignment.getRoleCode() != null ? "Ваша роль: " + assignment.getRoleCode() + "\n" : "")
                + (document.getSigningDeadline() != null ? "Срок подписания: " + document.getSigningDeadline() + "\n" : "")
                + "\nСсылка для подписания (действительна до " + assignment.getInvitationExpiresAt() + "):\n" + link + "\n\n"
                + "Ссылка предназначена только для вас и не должна передаваться третьим лицам.\n"
                + "Если вы не ожидали этого письма, проигнорируйте его.";
        emailOutboxService.enqueue(assignment.getEmail(), subject, body,
                EmailEvent.DOCUMENT_SIGNATURE_REQUIRED, "df-" + document.getId());
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }
}
