package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekDischargeSourceRepository extends JpaRepository<PekDischargeSource, Long> {
    List<PekDischargeSource> findByProgramIdOrderBySortOrderAscIdAsc(Long programId);
    Optional<PekDischargeSource> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
