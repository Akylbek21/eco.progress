package kz.eco.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailOutboxService {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxService.class);

    private final EmailOutboxRepository repository;

    public EmailOutboxService(EmailOutboxRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void enqueue(String toEmail, String subject, String body, EmailEvent event, String orderId) {
        if (toEmail == null || toEmail.isBlank()) {
            log.debug("Skip email {} — empty recipient (order={})", event, orderId);
            return;
        }
        EmailOutbox row = new EmailOutbox();
        row.setToEmail(toEmail.trim().toLowerCase());
        row.setSubject(subject);
        row.setBody(body);
        row.setEventType(event);
        row.setOrderId(orderId);
        repository.save(row);
    }
}
