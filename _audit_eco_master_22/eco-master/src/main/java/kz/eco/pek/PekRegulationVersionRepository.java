package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekRegulationVersionRepository extends JpaRepository<PekRegulationVersionRow, Long> {

    Optional<PekRegulationVersionRow> findByCode(String code);

    Optional<PekRegulationVersionRow> findByStatus(PekRegulationVersionStatus status);

    List<PekRegulationVersionRow> findAllByOrderByEffectiveFromDesc();
}
