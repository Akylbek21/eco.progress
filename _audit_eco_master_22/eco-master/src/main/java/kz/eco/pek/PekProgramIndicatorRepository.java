package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramIndicatorRepository extends JpaRepository<PekProgramIndicator, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramIndicator> findByProgramIdIn(java.util.Collection<Long> programIds);

    List<PekProgramIndicator> findByProgramIdOrderBySortOrderAsc(Long programId);

    List<PekProgramIndicator> findByControlItemIdOrderBySortOrderAsc(Long controlItemId);

    void deleteByProgramId(Long programId);
}
