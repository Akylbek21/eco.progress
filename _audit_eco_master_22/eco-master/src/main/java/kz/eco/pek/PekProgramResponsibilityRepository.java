package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekProgramResponsibilityRepository extends JpaRepository<PekProgramResponsibility, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramResponsibility> findByProgramIdIn(java.util.Collection<Long> programIds);
    List<PekProgramResponsibility> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekProgramResponsibility> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
