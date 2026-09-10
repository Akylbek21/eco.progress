package kz.eco.mail;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Component
public class EmailOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(EmailOutboxProcessor.class);

    private final EmailOutboxRepository repository;
    private final MailProperties properties;
    private final Optional<JavaMailSender> mailSender;

    public EmailOutboxProcessor(EmailOutboxRepository repository,
                                MailProperties properties,
                                Optional<JavaMailSender> mailSender) {
        this.repository = repository;
        this.properties = properties;
        this.mailSender = mailSender;
    }

    @Scheduled(fixedDelayString = "${eco.mail.poll-interval-ms:15000}")
    @Transactional
    public void processPending() {
        List<EmailOutbox> batch = repository.findTop50ByStatusOrderByCreatedAtAsc(EmailOutboxStatus.pending);
        for (EmailOutbox row : batch) {
            deliver(row);
        }
    }

    private void deliver(EmailOutbox row) {
        row.setAttempts(row.getAttempts() + 1);
        try {
            if (!properties.isEnabled() || mailSender.isEmpty()) {
                log.info("[email-outbox] {} → {} | {}", row.getEventType(), row.getToEmail(), row.getSubject());
                markSent(row);
                return;
            }
            MimeMessage message = mailSender.get().createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(properties.getFrom());
            helper.setTo(row.getToEmail());
            helper.setSubject(row.getSubject());
            helper.setText(row.getBody(), false);
            mailSender.get().send(message);
            markSent(row);
        } catch (Exception e) {
            row.setLastError(e.getMessage());
            if (row.getAttempts() >= properties.getMaxAttempts()) {
                row.setStatus(EmailOutboxStatus.failed);
            }
            repository.save(row);
            log.warn("Email delivery failed id={} to={}: {}", row.getId(), row.getToEmail(), e.getMessage());
        }
    }

    private void markSent(EmailOutbox row) {
        row.setStatus(EmailOutboxStatus.sent);
        row.setSentAt(LocalDateTime.now());
        repository.save(row);
    }
}
