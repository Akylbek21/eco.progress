package kz.eco.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findByRoleOrderByCreatedAtDesc(String role);
    List<Notification> findByUserIdOrRoleOrderByCreatedAtDesc(Long userId, String role);
    List<Notification> findAllByOrderByCreatedAtDesc();
}
