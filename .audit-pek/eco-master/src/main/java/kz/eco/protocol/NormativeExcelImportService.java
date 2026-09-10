package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.normative.NormativeRecordBuilder;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NormativeExcelImportService {

    private final NormativeReferenceService normativeService;
    private final ProtocolApiMapper mapper;

    public NormativeExcelImportService(NormativeReferenceService normativeService, ProtocolApiMapper mapper) {
        this.normativeService = normativeService;
        this.mapper = mapper;
    }

    public ProtocolApiDtos.NormativeImportPreviewResponse preview(MultipartFile file) throws Exception {
        ParsedSheet parsed = parse(file);
        return new ProtocolApiDtos.NormativeImportPreviewResponse(parsed.rows.size(), parsed.rows, parsed.warnings);
    }

    @Transactional
    public List<ProtocolApiDtos.NormativeRecord> confirm(MultipartFile file) throws Exception {
        ParsedSheet parsed = parse(file);
        List<ProtocolApiDtos.NormativeRecord> saved = new ArrayList<>();
        for (ProtocolApiDtos.NormativeRecord row : parsed.rows) {
            saved.add(normativeService.create(new ProtocolApiDtos.NormativeUpsertRequest(
                    row.templateId(), row.researchObject(), row.indicator(), row.unit(),
                    row.normativeType(), row.value(), row.min(), row.max(), row.comparisonType(),
                    row.normativeDocument(), row.testingMethod(), row.samplingMethod(),
                    row.validFrom(), row.validUntil(), true,
                    row.casNumber(), row.chemicalFormula(), row.normativeSubType(),
                    row.hazardClass(), row.limitingIndicator(),
                    row.sourceDocumentCode(), row.sourceDocumentName(),
                    row.documentNumber(), row.documentDate(),
                    row.appendixNo(), row.tableNo(),
                    row.factorType(), row.factorCode(), row.roomType(),
                    row.season(), row.workCategory(), row.workplaceType(),
                    row.normLevel(), row.conditionJson()
            )));
        }
        return saved;
    }

    private ParsedSheet parse(MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Загрузите файл Excel");
        }
        List<String> warnings = new ArrayList<>();
        List<ProtocolApiDtos.NormativeRecord> rows = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) throw new BadRequestException("Файл пуст");
            Map<Integer, String> columns = new HashMap<>();
            for (Cell cell : header) columns.put(cell.getColumnIndex(), text(cell));
            Integer indicatorCol = findColumn(columns, "показатель", "indicator", "вещество");
            if (indicatorCol == null) {
                throw new BadRequestException("Не найдена колонка показателя");
            }
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String indicator = text(row.getCell(indicatorCol));
                if (indicator == null || indicator.isBlank()) continue;
                rows.add(NormativeRecordBuilder.create()
                        .indicator(indicator)
                        .indicatorName(indicator)
                        .indicatorNameRu(indicator)
                        .templateId("workplace_air")
                        .unit(text(row.getCell(findColumn(columns, "едини"))))
                        .normativeType("PDK")
                        .value(text(row.getCell(findColumn(columns, "пдк", "value"))))
                        .comparisonType(ComparisonType.LESS_OR_EQUAL.name())
                        .normativeDocument(text(row.getCell(findColumn(columns, "документ", "нд"))))
                        .validFrom("2020-01-01")
                        .active(true)
                        .archived(false)
                        .build());
            }
        }
        if (rows.isEmpty()) warnings.add("Не найдено строк для импорта");
        return new ParsedSheet(rows, warnings);
    }

    private static Integer findColumn(Map<Integer, String> columns, String... keys) {
        for (var entry : columns.entrySet()) {
            String h = entry.getValue() != null ? entry.getValue().toLowerCase() : "";
            for (String key : keys) {
                if (h.contains(key)) return entry.getKey();
            }
        }
        return null;
    }

    private static String text(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            default -> null;
        };
    }

    private record ParsedSheet(List<ProtocolApiDtos.NormativeRecord> rows, List<String> warnings) {
    }
}
