package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramMeasurementQaRepository extends JpaRepository<PekProgramMeasurementQa, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramMeasurementQa> findByProgramIdIn(java.util.Collection<Long> programIds);
    List<PekProgramMeasurementQa> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramMeasurementQa> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
