package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramMeasurementQaRepository extends JpaRepository<PekProgramMeasurementQa, Long> {
    List<PekProgramMeasurementQa> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramMeasurementQa> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
