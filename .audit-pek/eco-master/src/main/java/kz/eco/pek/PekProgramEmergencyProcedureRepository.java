package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramEmergencyProcedureRepository extends JpaRepository<PekProgramEmergencyProcedure, Long> {
    List<PekProgramEmergencyProcedure> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramEmergencyProcedure> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
