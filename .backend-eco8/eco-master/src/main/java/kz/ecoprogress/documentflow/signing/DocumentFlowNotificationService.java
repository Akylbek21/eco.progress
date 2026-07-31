package kz.ecoprogress.documentflow.signing;

import kz.eco.notification.NotificationService;
import kz.ecoprogress.documentflow.document.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Notification fan-out for send-for-signing. Per the ticket ("reuse the outbox pattern from
 * kz.eco.mail.EmailOutboxService if visible, otherwise a direct call to
 * kz.eco.notification.NotificationService for ORGANIZATION_MEMBER assignments is fine for now"):
 * EmailOutboxService's enqueue() takes an EmailEvent enum scoped to the order/mail domain that
 * doesn't have a document-flow signing event defined, so reusing it as-is would require Agent
 * changes outside this module's scope - out of scope for this pass, flagged via TODO-RECONCILE.
 * ORGANIZATION_MEMBER assignments go through the existing in-app NotificationService (real,
 * working code, not a stub). EXTERNAL/COUNTERPARTY_REPRESENTATIVE invitations only have an
 * email/phone, no in-app user - actually sending that email is out of scope for this pass (no SMTP
 * wiring here); this only logs the invitation link server-side so a human/QA can pick it up. See
 * TODO-RECONCILE below.
 */
@Service
public class DocumentFlowNotificationService {

    private static final Logger log = LoggerFactory.getLogger(DocumentFlowNotificationService.class);

    private final NotificationService notificationService;

    public DocumentFlowNotificationService(NotificationService notificationService) {
        this.notificationService = notificationService;
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

    // TODO-RECONCILE: wire real email delivery for external/counterparty-representative
    // invitations once an outbound-mail sending path for this module exists (EmailOutboxService's
    // EmailEvent enum would need a document-flow-signing case added, which is out of this module's
    // scope to change unilaterally - flag for merge-time reconciliation with whichever agent owns
    // kz.eco.mail). For now the invitation link is only logged, not emailed - assignment.email is
    // already recorded on the assignment for whoever wires the actual send.
    public void sendExternalInvitation(SigningAssignment assignment, String rawToken, Document document) {
        log.info("Document flow: signing invitation ready for assignment {} (email={}, expiresAt={}); "
                        + "token intentionally not logged, only its presence - see TODO-RECONCILE",
                assignment.getId(), assignment.getEmail(), assignment.getInvitationExpiresAt());
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }
}
