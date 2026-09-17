package kz.eco.normative;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PollutantRepository extends JpaRepository<Pollutant, Long> {
    Optional<Pollutant> findByCode(String code);
    List<Pollutant> findByActiveTrueOrderByCodeAsc();
    boolean existsByCode(String code);

    @Query("""
            SELECT p FROM Pollutant p
            WHERE p.active = true
              AND (
                :queryBlank = true OR
                LOWER(p.code) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(p.nameRu, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(p.nameKz, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(p.aliases, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(p.chemicalFormula, '')) LIKE LOWER(CONCAT('%', :query, '%'))
              )
            ORDER BY p.code
            """)
    List<Pollutant> searchActive(
            @Param("query") String query,
            @Param("queryBlank") boolean queryBlank,
            org.springframework.data.domain.Pageable pageable);
}
