package kz.eco.task;

import kz.eco.common.exception.NotFoundException;
import kz.eco.task.dto.CreateTaskRequest;
import kz.eco.task.dto.TaskResponse;
import kz.eco.task.dto.UpdateTaskRequest;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TaskService {

    private final StaffTaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskService(StaffTaskRepository taskRepository,
                       UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> findAll() {
        return taskRepository.findAllByOrderByDueDateAscCreatedAtDesc().stream()
                .map(TaskResponse::from).toList();
    }

    @Transactional
    public TaskResponse create(CreateTaskRequest req) {
        StaffTask task = new StaffTask();
        task.setTitle(req.title());
        task.setDescription(req.description());
        task.setOrderId(req.orderId());
        task.setDueDate(req.dueDate());
        if (req.assigneeId() != null) {
            task.setAssignee(userRepository.findById(req.assigneeId())
                    .orElseThrow(() -> new NotFoundException("Исполнитель не найден")));
        }
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(Long id, UpdateTaskRequest req) {
        StaffTask task = taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задача не найдена"));
        if (req.title() != null) task.setTitle(req.title());
        if (req.description() != null) task.setDescription(req.description());
        if (req.orderId() != null) task.setOrderId(req.orderId());
        if (req.dueDate() != null) task.setDueDate(req.dueDate());
        if (req.status() != null) task.setStatus(req.status());
        if (req.assigneeId() != null) {
            task.setAssignee(userRepository.findById(req.assigneeId())
                    .orElseThrow(() -> new NotFoundException("Исполнитель не найден")));
        }
        task.setUpdatedAt(LocalDateTime.now());
        return TaskResponse.from(taskRepository.save(task));
    }
}
