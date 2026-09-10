package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekWasteItemRepository extends JpaRepository<PekWasteItem, Long> {
    List<PekWasteItem> findByProgramIdOrderBySortOrderAscIdAsc(Long programId);
    Optional<PekWasteItem> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
