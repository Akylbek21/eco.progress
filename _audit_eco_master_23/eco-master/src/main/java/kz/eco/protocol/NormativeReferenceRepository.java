package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface NormativeReferenceRepository extends JpaRepository<NormativeReference, Long> {

    List<NormativeReference> findByActiveTrueOrderByIndicatorNameAsc();

    boolean existsByTemplateCodeAndIndicatorNameIgnoreCase(String templateCode, String indicatorName);

    @Query("""
            SELECT n FROM NormativeReference n
            WHERE n.active = true
              AND n.templateCode = :templateCode
              AND LOWER(n.indicatorName) = LOWER(:indicatorName)
              AND (:objectType IS NULL OR n.objectType IS NULL OR LOWER(n.objectType) = LOWER(:objectType))
              AND (:unit IS NULL OR n.unit IS NULL OR LOWER(n.unit) = LOWER(:unit))
              AND (n.activeFrom IS NULL OR n.activeFrom <= :onDate)
              AND (n.activeTo IS NULL OR n.activeTo >= :onDate)
            ORDER BY n.activeFrom DESC
            """)
    List<NormativeReference> searchActive(
            @Param("templateCode") String templateCode,
            @Param("indicatorName") String indicatorName,
            @Param("objectType") String objectType,
            @Param("unit") String unit,
            @Param("onDate") LocalDate onDate
    );
}
