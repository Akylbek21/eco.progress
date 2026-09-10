package kz.eco.task;

import jakarta.validation.Valid;
import kz.eco.common.ApiResponse;
import kz.eco.task.dto.CalendarEventResponse;
import kz.eco.task.dto.CreateTaskRequest;
import kz.eco.task.dto.TaskResponse;
import kz.eco.task.dto.UpdateTaskRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@PreAuthorize(SecurityExpressions.STAFF)
public class StaffCrmController {

    private final TaskService taskService;
    private final CalendarService calendarService;

    public StaffCrmController(TaskService taskService, CalendarService calendarService) {
        this.taskService = taskService;
        this.calendarService = calendarService;
    }

    @GetMapping("/api/staff/tasks")
    public ApiResponse<List<TaskResponse>> tasks() {
        return ApiResponse.ok(taskService.findAll());
    }

    @PostMapping("/api/staff/tasks")
    public ApiResponse<TaskResponse> createTask(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.ok(taskService.create(request), "Задача создана");
    }

    @PatchMapping("/api/staff/tasks/{id}")
    public ApiResponse<TaskResponse> updateTask(@PathVariable Long id,
                                                 @Valid @RequestBody UpdateTaskRequest request) {
        return ApiResponse.ok(taskService.update(id, request), "Задача обновлена");
    }

    @GetMapping("/api/staff/calendar")
    public ApiResponse<List<CalendarEventResponse>> calendar() {
        return ApiResponse.ok(calendarService.events());
    }
}
