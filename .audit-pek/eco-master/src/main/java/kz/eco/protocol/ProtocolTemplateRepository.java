package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProtocolTemplateRepository extends JpaRepository<ProtocolTemplate, Long> {
    Optional<ProtocolTemplate> findByCode(String code);

    List<ProtocolTemplate> findByActiveTrueOrderByNameAsc();
}
