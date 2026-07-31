package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramControlItemRepository extends JpaRepository<PekProgramControlItem, Long> {

    List<PekProgramControlItem> findByProgramIdOrderBySortOrderAsc(Long programId);

    void deleteByProgramId(Long programId);

    long countByProgramId(Long programId);
}
