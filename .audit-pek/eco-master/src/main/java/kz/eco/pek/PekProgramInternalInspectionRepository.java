package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramInternalInspectionRepository extends JpaRepository<PekProgramInternalInspection, Long> {
    List<PekProgramInternalInspection> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramInternalInspection> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
