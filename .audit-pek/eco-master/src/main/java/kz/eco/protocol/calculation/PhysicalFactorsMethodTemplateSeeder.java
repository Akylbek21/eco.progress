package kz.eco.protocol.calculation;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

@Configuration
@Order(23)
public class PhysicalFactorsMethodTemplateSeeder implements CommandLineRunner {

    private final MethodTemplateRepository templateRepo;
    private final MethodVariableRepository variableRepo;

    public PhysicalFactorsMethodTemplateSeeder(MethodTemplateRepository templateRepo,
                                                MethodVariableRepository variableRepo) {
        this.templateRepo = templateRepo;
        this.variableRepo = variableRepo;
    }

    @Override
    public void run(String... args) {
        seed("LIGHTING_BASIC", "Расчет освещённости", "LIGHTING", "Освещённость",
                "Методика измерения освещённости", "лк", "лк");
        seed("KEO_BASIC", "Расчет коэффициента естественной освещённости", "KEO",
                "Коэффициент естественной освещённости", "Методика измерения KEO", "%", "%");
        seed("LIGHT_PULSATION_BASIC", "Расчет пульсации освещённости", "LIGHT_PULSATION",
                "Пульсация освещённости", "Методика измерения пульсации освещённости", "%", "%");
    }

    private void seed(String code, String name, String pollutantCode, String pollutantName,
                      String methodDocument, String measurementUnit, String resultUnit) {
        if (templateRepo.findByCode(code).isPresent()) {
            return;
        }
        MethodTemplate template = new MethodTemplate();
        template.setCode(code);
        template.setName(name);
        template.setProtocolTemplateCode("physical_factors");
        template.setPollutantCode(pollutantCode);
        template.setPollutantName(pollutantName);
        template.setMethodDocument(methodDocument);
        template.setMeasurementUnit(measurementUnit);
        template.setResultUnit(resultUnit);
        template.setFormulaExpression("deviceValue");
        template.setDecimalPlaces(2);
        template.setRoundingMode("HALF_UP");
        template.setActive(true);
        templateRepo.save(template);

        MethodVariable variable = new MethodVariable();
        variable.setMethodTemplateId(template.getId());
        variable.setVariableKey("deviceValue");
        variable.setVariableLabel("LIGHTING_BASIC".equals(code)
                ? "Показание люксметра"
                : "Показание прибора");
        variable.setUnit(measurementUnit);
        variable.setType("NUMBER");
        variable.setRequired(true);
        variable.setDisplayOrder(1);
        variableRepo.save(variable);
    }
}
