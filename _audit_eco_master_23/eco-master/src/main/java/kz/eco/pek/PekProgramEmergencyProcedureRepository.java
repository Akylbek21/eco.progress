package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramEmergencyProcedureRepository extends JpaRepository<PekProgramEmergencyProcedure, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramEmergencyProcedure> findByProgramIdIn(java.util.Collection<Long> programIds);
    List<PekProgramEmergencyProcedure> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramEmergencyProcedure> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
