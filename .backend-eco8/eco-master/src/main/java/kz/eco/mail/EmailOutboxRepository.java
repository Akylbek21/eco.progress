package kz.eco.mail;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, Long> {
    List<EmailOutbox> findTop50ByStatusOrderByCreatedAtAsc(EmailOutboxStatus status);
}
