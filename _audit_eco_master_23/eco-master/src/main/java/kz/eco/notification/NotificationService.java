package kz.eco.notification;

import kz.eco.common.exception.NotFoundException;
import kz.eco.notification.dto.NotificationResponse;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void notify(Long userId, String role, String orderId,
                       String title, String message, String type) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setRole(role);
        n.setOrderId(orderId);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        repository.save(n);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> findForUser(User user) {
        if (user == null) return List.of();
        List<Notification> list = repository.findByUserIdOrRoleOrderByCreatedAtDesc(
                user.getId(), user.getRole().name());
        return list.stream().map(NotificationResponse::from).toList();
    }

    @Transactional
    public void markRead(Long id, User user) {
        Notification n = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Уведомление не найдено"));
        if (user != null && n.getUserId() != null && !n.getUserId().equals(user.getId())) {
            if (n.getRole() == null || !n.getRole().equals(user.getRole().name())) {
                throw new NotFoundException("Уведомление не найдено");
            }
        }
        n.setRead(true);
        repository.save(n);
    }
}
