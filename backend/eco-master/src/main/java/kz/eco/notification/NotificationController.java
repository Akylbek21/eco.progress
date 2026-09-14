package kz.eco.notification;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.notification.dto.NotificationResponse;
import kz.eco.user.User;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<NotificationResponse>> list() {
        return ApiResponse.ok(service.findForUser(CurrentUser.get()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id) {
        service.markRead(id, CurrentUser.get());
        return ApiResponse.message("Прочитано");
    }
}
