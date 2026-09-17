package kz.eco.laboratory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LaboratoryRepository extends JpaRepository<Laboratory, Long> {
    List<Laboratory> findByActiveTrueOrderByNameAsc();
    List<Laboratory> findAllByOrderByNameAsc();
    Optional<Laboratory> findFirstByIsDefaultTrueAndActiveTrue();

    /** Used by FileController to resolve ownership of a bare fileId against a laboratory logo. */
    Optional<Laboratory> findByLogoFileId(String logoFileId);

    @Query("SELECT l FROM Laboratory l ORDER BY l.isDefault DESC, l.active DESC, l.name ASC")
    List<Laboratory> findAllOrderedByDefaultThenActiveThenName();

    long countByActiveTrue();

    boolean existsByBin(String bin);

    boolean existsByBinAndIdNot(String bin, Long id);
}
