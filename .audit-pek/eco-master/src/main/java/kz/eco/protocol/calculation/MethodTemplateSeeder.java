package kz.eco.protocol.calculation;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;

@Configuration
@Order(22)
public class MethodTemplateSeeder implements CommandLineRunner {

    private final MethodTemplateRepository templateRepo;
    private final MethodVariableRepository variableRepo;
    private final RepeatabilityRuleRepository repeatabilityRepo;
    private final UncertaintyRuleRepository uncertaintyRepo;

    public MethodTemplateSeeder(MethodTemplateRepository templateRepo,
                                 MethodVariableRepository variableRepo,
                                 RepeatabilityRuleRepository repeatabilityRepo,
                                 UncertaintyRuleRepository uncertaintyRepo) {
        this.templateRepo = templateRepo;
        this.variableRepo = variableRepo;
        this.repeatabilityRepo = repeatabilityRepo;
        this.uncertaintyRepo = uncertaintyRepo;
    }

    @Override
    public void run(String... args) {
        if (templateRepo.findByCode("WATER_SULFATES").isPresent()) {
            return;
        }

        seedWaterSulfates();
    }

    private void seedWaterSulfates() {
        MethodTemplate t = new MethodTemplate();
        t.setCode("WATER_SULFATES");
        t.setName("Определение сульфатов в воде");
        t.setProtocolTemplateCode("water_wastewater");
        t.setPollutantCode("SO4");
        t.setPollutantName("Сульфаты");
        t.setMethodDocument("ГОСТ 4389-72");
        t.setMeasurementUnit("мг/дм³");
        t.setResultUnit("мг/дм³");
        t.setFormulaExpression("deviceValue * dilutionFactor");
        t.setDecimalPlaces(3);
        t.setRoundingMode("HALF_UP");
        t.setActive(true);
        templateRepo.save(t);

        addVariable(t.getId(), "deviceValue", "Показание прибора", "мг/дм³", true, null, 1);
        addVariable(t.getId(), "dilutionFactor", "Коэффициент разбавления", null, true, BigDecimal.ONE, 2);
        addVariable(t.getId(), "parallel1", "Параллельное измерение №1", "мг/дм³", false, null, 3);
        addVariable(t.getId(), "parallel2", "Параллельное измерение №2", "мг/дм³", false, null, 4);
        addVariable(t.getId(), "parallel3", "Параллельное измерение №3", "мг/дм³", false, null, 5);

        RepeatabilityRule rr = new RepeatabilityRule();
        rr.setMethodTemplateId(t.getId());
        rr.setName("Проверка сходимости для сульфатов");
        rr.setMaxDifferencePercent(new BigDecimal("20"));
        rr.setMessage("Превышен предел повторяемости (20%). Требуется повторный анализ.");
        rr.setActive(true);
        repeatabilityRepo.save(rr);

        UncertaintyRule ur = new UncertaintyRule();
        ur.setMethodTemplateId(t.getId());
        ur.setName("Погрешность для сульфатов");
        ur.setUncertaintyPercent(new BigDecimal("10"));
        ur.setActive(true);
        uncertaintyRepo.save(ur);
    }

    private void addVariable(Long templateId, String key, String label, String unit,
                              boolean required, BigDecimal defaultValue, int order) {
        MethodVariable v = new MethodVariable();
        v.setMethodTemplateId(templateId);
        v.setVariableKey(key);
        v.setVariableLabel(label);
        v.setUnit(unit);
        v.setRequired(required);
        v.setDefaultValue(defaultValue);
        v.setDisplayOrder(order);
        variableRepo.save(v);
    }
}
