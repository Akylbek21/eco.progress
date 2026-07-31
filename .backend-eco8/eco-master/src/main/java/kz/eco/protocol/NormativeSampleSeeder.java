package kz.eco.protocol;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Seeds a handful of demo normatives ("СЭМ РК (демо)") for local/dev testing only —
 * must never run in production, where imported DSM_15/32/70 data is authoritative.
 */
@Configuration
@Profile({"dev", "local"})
@Order(21)
public class NormativeSampleSeeder implements CommandLineRunner {

    private final NormativeReferenceRepository repository;

    public NormativeSampleSeeder(NormativeReferenceRepository repository) {
        this.repository = repository;
    }

    private static final List<DemoNormative> DEMOS = List.of(
            new DemoNormative("workplace_air", "Пыль", "0300", "air", "мг/м³",
                    NormativeType.PDK, new BigDecimal("4.0"), ComparisonType.LESS_OR_EQUAL),
            new DemoNormative("water_wastewater", "Железо", "0123", "water", "мг/дм³",
                    NormativeType.PDS, new BigDecimal("0.3"), ComparisonType.LESS_OR_EQUAL),
            new DemoNormative("ambient_air", "Диоксид азота", "0301", "air", "мг/м³",
                    NormativeType.PDK, new BigDecimal("0.04"), ComparisonType.LESS_OR_EQUAL),
            new DemoNormative("physical_factors", "Шум", "NOISE", "workplace", "дБА",
                    NormativeType.PDK, new BigDecimal("80"), ComparisonType.LESS_OR_EQUAL),
            new DemoNormative("sanitary_hygiene", "E.coli", "ECOLI", "water", "КОЕ/100 мл",
                    NormativeType.PDK, BigDecimal.ZERO, ComparisonType.LESS_OR_EQUAL)
    );

    @Override
    public void run(String... args) {
        for (DemoNormative demo : DEMOS) {
            if (!repository.existsByTemplateCodeAndIndicatorNameIgnoreCase(demo.templateCode(), demo.indicator())) {
                save(demo);
            }
        }
    }

    private void save(DemoNormative demo) {
        NormativeReference n = new NormativeReference();
        n.setTemplateCode(demo.templateCode());
        n.setIndicatorName(demo.indicator());
        n.setObjectType(demo.environment());
        n.setUnit(demo.unit());
        n.setNormativeType(demo.normativeType());
        n.setNormativeValue(demo.value());
        n.setComparisonType(demo.comparisonType());
        n.setNormativeDocument("СЭМ РК (демо)");
        n.setActiveFrom(LocalDate.of(2020, 1, 1));
        n.setActive(true);
        repository.save(n);
    }

    private record DemoNormative(
            String templateCode,
            String indicator,
            String pollutantCode,
            String environment,
            String unit,
            NormativeType normativeType,
            BigDecimal value,
            ComparisonType comparisonType
    ) {
    }
}
