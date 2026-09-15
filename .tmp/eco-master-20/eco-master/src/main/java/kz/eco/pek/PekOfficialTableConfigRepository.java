package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekOfficialTableConfigRepository extends JpaRepository<PekOfficialTableConfigRow, Long> {

    List<PekOfficialTableConfigRow> findByRegulationCodeOrderByDisplayOrderAsc(String regulationCode);

    Optional<PekOfficialTableConfigRow> findByRegulationCodeAndTableType(String regulationCode, PekOfficialTableType tableType);

    boolean existsByRegulationCode(String regulationCode);
}
