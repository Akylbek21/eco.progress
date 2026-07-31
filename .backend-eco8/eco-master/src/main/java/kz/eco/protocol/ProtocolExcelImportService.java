package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
public class ProtocolExcelImportService {

    private final ProtocolService protocolService;

    public ProtocolExcelImportService(ProtocolService protocolService) {
        this.protocolService = protocolService;
    }

    @Transactional
    public ProtocolApiDtos.ProtocolResponse importExcel(Long protocolId, MultipartFile file, Long userId) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Загрузите файл Excel");
        }
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) {
                throw new BadRequestException("Файл пуст");
            }
            Map<Integer, String> columns = new HashMap<>();
            for (Cell cell : header) {
                columns.put(cell.getColumnIndex(), cellString(cell));
            }
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isEmptyRow(row)) continue;
                Map<String, Object> values = new HashMap<>();
                for (var entry : columns.entrySet()) {
                    String key = mapColumn(entry.getValue());
                    if (key != null) {
                        values.put(key, cellValue(row.getCell(entry.getKey())));
                    }
                }
                protocolService.addResult(protocolId, new ProtocolApiDtos.ResultRow(null, null, null, values), userId);
            }
        }
        protocolService.checkNormatives(protocolId, userId);
        return protocolService.get(protocolId);
    }

    private static String mapColumn(String header) {
        if (header == null) return null;
        String h = header.trim().toLowerCase();
        if (h.contains("показатель") || h.equals("indicator")) return "indicator";
        if (h.contains("едини")) return "unit";
        if (h.contains("результат")) return "result";
        if (h.contains("место")) return "samplingPlace";
        return null;
    }

    private static boolean isEmptyRow(Row row) {
        for (int i = 0; i < 5; i++) {
            Cell cell = row.getCell(i);
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String v = cellString(cell);
                if (v != null && !v.isBlank()) return false;
            }
        }
        return true;
    }

    private static String cellString(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    private static Object cellValue(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        return cellString(cell);
    }
}
