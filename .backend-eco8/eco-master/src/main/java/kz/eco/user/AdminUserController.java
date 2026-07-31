package kz.eco.user;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.dto.AdminUserCreateRequest;
import kz.eco.user.dto.AdminUserResponse;
import kz.eco.user.dto.AdminUserStatusRequest;
import kz.eco.user.dto.AdminUserUpdateRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ApiResponse<List<AdminUserResponse>> getUsers() {
        return ApiResponse.ok(adminUserService.getUsers());
    }

    @PostMapping
    public ApiResponse<AdminUserResponse> createUser(@Valid @RequestBody AdminUserCreateRequest request) {
        return ApiResponse.ok(adminUserService.createUser(request), "Пользователь создан");
    }

    @PatchMapping("/{id}")
    public ApiResponse<AdminUserResponse> updateUser(@PathVariable Long id,
                                                     @Valid @RequestBody AdminUserUpdateRequest request) {
        return ApiResponse.ok(adminUserService.updateUser(id, request), "Пользователь обновлён");
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<AdminUserResponse> changeStatus(@PathVariable Long id,
                                                       @Valid @RequestBody AdminUserStatusRequest request) {
        User actor = CurrentUser.getOrNull();
        Long actorId = actor != null ? actor.getId() : null;
        return ApiResponse.ok(
                adminUserService.changeStatus(id, request, actorId),
                "Статус пользователя обновлён"
        );
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteUser(@PathVariable Long id) {
        User actor = CurrentUser.getOrNull();
        Long actorId = actor != null ? actor.getId() : null;
        adminUserService.deleteUser(id, actorId);
        return ApiResponse.ok(true, "Пользователь удалён");
    }
}
