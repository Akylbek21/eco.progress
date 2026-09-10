package kz.eco.protocol;

import org.springframework.boot.CommandLineRunner;

import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

@Configuration
@Order(20)
public class ProtocolTemplateSeeder implements CommandLineRunner {

    private final ProtocolTemplateRepository templateRepository;

    public ProtocolTemplateSeeder(ProtocolTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    private static final List<String> LEGACY_CODES = List.of(
            "AMBIENT_AIR", "ATMOSPHERIC_AIR", "PHYSICAL_FACTORS"
    );

    @Override
    public void run(String... args) {
        for (String legacy : LEGACY_CODES) {
            templateRepository.findByCode(legacy).ifPresent(template -> {
                template.setActive(false);
                templateRepository.save(template);
            });
        }
        for (ProtocolTemplateCode code : ProtocolTemplateCode.values()) {
            templateRepository.findByCode(code.name()).orElseGet(() -> {
                ProtocolTemplate template = new ProtocolTemplate();
                template.setCode(code.name());
                template.setName(code.title());
                template.setDescription(code.title());
                template.setFormCode(code.numberPrefix());
                template.setActive(true);
                return templateRepository.save(template);
            });
        }
    }
}
