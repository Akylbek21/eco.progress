package kz.eco.normative.dsm32;

import kz.eco.normative.ImportNormativeType;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.physical.PhysicalFactorValueParser;
import kz.eco.protocol.ComparisonType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class Dsm32SoilPdkTableParser implements Dsm32TableParser {

    private static final String PARSER_TYPE = "DSM32_SOIL_PDK_TABLE";
    private static final String UNIT = "мг/кг";

    @Override
    public boolean supports(String parserType) {
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(Dsm32ImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();
        String currentFormType = null;

        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row.isEmpty()) {
                continue;
            }

            String col0 = cell(row, 0);
            String col1 = cell(row, 1);
            String col2 = cell(row, 2);
            String col3 = cell(row, 3);

            if (Dsm32NameCleaner.isFormGroupRow(col0 != null ? col0 : col1)) {
                currentFormType = normalizeFormType(col0 != null ? col0 : col1);
                continue;
            }
            if (Dsm32NameCleaner.isHeaderOrGroupRow(col0, col1)) {
                continue;
            }
            if (col1 == null || col1.isBlank()) {
                continue;
            }

            String substance = Dsm32NameCleaner.cleanSubstanceName(col1);
            if (substance == null) {
                continue;
            }

            NormativeRecord record = new NormativeRecord();
            record.setTableNo(context.tableNo());
            record.setIndicatorNameRu(substance);
            record.setUnit(UNIT);
            record.setLimitingIndicator(normalizeLimitingIndicator(col3));
            record.setFormType(currentFormType);
            record.setNormativeType(ImportNormativeType.PDK);
            record.setSourceRowNumber(i + 1);

            if (col2 == null || col2.isBlank() || Dsm32NameCleaner.isComplexValue(col2)) {
                record.setComparisonType(ComparisonType.INFO);
                record.setSourceRawValue(col2);
                record.setConditionJson(Dsm32JsonHelper.rawValueJson(col2));
            } else {
                var parsed = PhysicalFactorValueParser.parse(col2, ComparisonType.LESS_OR_EQUAL);
                record.setValue(parsed.value());
                record.setMinValue(parsed.minValue());
                record.setMaxValue(parsed.maxValue());
                record.setComparisonType(parsed.comparisonType());
                if (parsed.value() == null && parsed.comparisonType() == ComparisonType.INFO) {
                    record.setSourceRawValue(col2);
                    record.setConditionJson(Dsm32JsonHelper.rawValueJson(col2));
                }
            }

            records.add(record);
        }
        return records;
    }

    private static String normalizeFormType(String raw) {
        if (raw == null) {
            return null;
        }
        String lower = raw.trim().toLowerCase();
        if (lower.contains("подвиж")) {
            return "подвижная форма";
        }
        if (lower.contains("водораствор")) {
            return "водорастворимая форма";
        }
        return raw.trim();
    }

    private static String normalizeLimitingIndicator(String raw) {
        if (raw == null || raw.isBlank() || "-\"-".equals(raw.trim()) || "\"-\"".equals(raw.trim())) {
            return null;
        }
        return raw.trim();
    }

    private static String cell(List<String> row, int index) {
        if (index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null ? value.trim() : null;
    }
}
