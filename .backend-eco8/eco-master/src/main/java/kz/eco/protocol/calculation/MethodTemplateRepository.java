package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MethodTemplateRepository extends JpaRepository<MethodTemplate, Long> {
    List<MethodTemplate> findByActiveTrueOrderByNameAsc();
    Optional<MethodTemplate> findByCode(String code);
    Optional<MethodTemplate> findFirstByPollutantCodeAndProtocolTemplateCodeAndActiveTrue(String pollutantCode, String protocolTemplateCode);
    Optional<MethodTemplate> findFirstByPollutantNameAndProtocolTemplateCodeAndActiveTrue(String pollutantName, String protocolTemplateCode);
}
