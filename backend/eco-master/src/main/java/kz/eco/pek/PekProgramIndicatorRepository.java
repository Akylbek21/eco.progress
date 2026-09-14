package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekProgramIndicatorRepository extends JpaRepository<PekProgramIndicator, Long> {

    List<PekProgramIndicator> findByProgramIdOrderBySortOrderAsc(Long programId);

    List<PekProgramIndicator> findByControlItemIdOrderBySortOrderAsc(Long controlItemId);

    void deleteByProgramId(Long programId);
}
