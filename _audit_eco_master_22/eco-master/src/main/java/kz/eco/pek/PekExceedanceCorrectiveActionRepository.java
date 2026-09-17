package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekExceedanceCorrectiveActionRepository extends JpaRepository<PekExceedanceCorrectiveAction, Long> {

    List<PekExceedanceCorrectiveAction> findByExceedanceIdOrderByIdAsc(Long exceedanceId);

    Optional<PekExceedanceCorrectiveAction> findByIdAndExceedanceId(Long id, Long exceedanceId);
}
