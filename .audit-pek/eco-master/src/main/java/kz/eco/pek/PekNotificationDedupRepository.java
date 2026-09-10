package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PekNotificationDedupRepository extends JpaRepository<PekNotificationDedup, Long> {

    Optional<PekNotificationDedup> findByEntityTypeAndEntityIdAndNotifyType(
            String entityType, Long entityId, String notifyType);
}
