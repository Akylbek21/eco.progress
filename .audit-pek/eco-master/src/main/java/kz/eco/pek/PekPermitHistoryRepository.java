package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekPermitHistoryRepository extends JpaRepository<PekPermitHistory, Long> {
    List<PekPermitHistory> findByPermitIdOrderByPerformedAtAsc(Long permitId);
}
