package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekEmissionSourceRepository extends JpaRepository<PekEmissionSource, Long> {
    List<PekEmissionSource> findByProgramIdOrderBySortOrderAscIdAsc(Long programId);
    Optional<PekEmissionSource> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
