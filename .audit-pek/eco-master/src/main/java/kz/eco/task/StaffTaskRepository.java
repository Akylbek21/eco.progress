package kz.eco.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StaffTaskRepository extends JpaRepository<StaffTask, Long> {
    List<StaffTask> findAllByOrderByDueDateAscCreatedAtDesc();
}
