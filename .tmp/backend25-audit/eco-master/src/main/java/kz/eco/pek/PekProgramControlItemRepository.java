package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramControlItemRepository extends JpaRepository<PekProgramControlItem, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekProgramControlItem> findByProgramIdIn(java.util.Collection<Long> programIds);

    List<PekProgramControlItem> findByProgramIdOrderBySortOrderAsc(Long programId);

    void deleteByProgramId(Long programId);

    long countByProgramId(Long programId);

    List<PekProgramControlItem> findByProgramIdAndActiveTrue(Long programId);

    /** Positions bound to a concrete monitoring point - a point still referenced here must not be
     *  deleted, or those positions would silently lose their point. */
    List<PekProgramControlItem> findByMonitoringPointId(Long monitoringPointId);
}
