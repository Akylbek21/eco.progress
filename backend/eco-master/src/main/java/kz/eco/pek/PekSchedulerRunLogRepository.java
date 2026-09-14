package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface PekSchedulerRunLogRepository extends JpaRepository<PekSchedulerRunLog, Long> {

    List<PekSchedulerRunLog> findByJobNameOrderByStartedAtDesc(String jobName, Pageable pageable);
}
