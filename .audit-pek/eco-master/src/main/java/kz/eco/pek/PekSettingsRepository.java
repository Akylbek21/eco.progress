package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PekSettingsRepository extends JpaRepository<PekSettings, Long> {
    Optional<PekSettings> findByCompanyId(Long companyId);
}
