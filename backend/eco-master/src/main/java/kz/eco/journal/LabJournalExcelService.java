package kz.eco.journal;

import kz.eco.common.exception.BadRequestException;
import kz.eco.laboratory.LaboratoryRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Renders a journal (filled or as an empty template) into an .xlsx styled like a paper logbook. */
@Service
public class LabJournalExcelService {

    /** Journals with more columns than this are laid out landscape so the table fits on A4 width. */
    private static final int LANDSCAPE_COLUMN_THRESHOLD = 7;

    private final LaboratoryRepository laboratoryRepository;

    public LabJournalExcelService(LaboratoryRepository laboratoryRepository) {
        this.laboratoryRepository = laboratoryRepository;
    }

    public byte[] export(JournalType type, List<Map<String, Object>> rows,
                          LocalDate dateFrom, LocalDate dateTo, Long laboratoryId) {
        return build(JournalTypeRegistry.get(type), rows, dateFrom, dateTo, laboratoryId);
    }

    public byte[] exportEmptyTemplate(JournalType type, Long laboratoryId) {
        return build(JournalTypeRegistry.get(type), List.of(), null, null, laboratoryId);
    }

    private byte[] build(JournalDefinition definition, List<Map<String, Object>> rows,
                          LocalDate dateFrom, LocalDate dateTo, Long laboratoryId) {
        List<JournalColumn> columns = definition.columns();
        int lastColumnIndex = columns.size() - 1;

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Журнал");

            CellStyle titleStyle = titleStyle(workbook, HorizontalAlignment.LEFT);
            CellStyle centeredTitleStyle = titleStyle(workbook, HorizontalAlignment.CENTER);
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle cellStyle = dataCellStyle(workbook);

            int rowIdx = 0;
            rowIdx = writeMergedTextRow(sheet, rowIdx, lastColumnIndex, resolveLaboratoryName(laboratoryId), titleStyle);
            rowIdx = writeMergedTextRow(sheet, rowIdx, lastColumnIndex, definition.title(), centeredTitleStyle);
            if (dateFrom != null || dateTo != null) {
                String period = "Период: с " + (dateFrom != null ? dateFrom : "…") + " по " + (dateTo != null ? dateTo : "…");
                rowIdx = writeMergedTextRow(sheet, rowIdx, lastColumnIndex, period, titleStyle);
            }
            rowIdx++;

            Row headerRow = sheet.createRow(rowIdx++);
            for (int i = 0; i < columns.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns.get(i).title());
                cell.setCellStyle(headerStyle);
            }

            for (Map<String, Object> data : rows) {
                Row row = sheet.createRow(rowIdx++);
                for (int i = 0; i < columns.size(); i++) {
                    Object value = data.get(columns.get(i).key());
                    Cell cell = row.createCell(i);
                    cell.setCellValue(value != null ? String.valueOf(value) : "");
                    cell.setCellStyle(cellStyle);
                }
            }

            applyColumnWidths(sheet, columns.size());
            applyPageSetup(sheet, columns.size());

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать Excel: " + e.getMessage());
        }
    }

    private int writeMergedTextRow(Sheet sheet, int rowIdx, int lastColumnIndex, String text, CellStyle style) {
        Row row = sheet.createRow(rowIdx);
        Cell cell = row.createCell(0);
        cell.setCellValue(text);
        cell.setCellStyle(style);
        if (lastColumnIndex > 0) {
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, lastColumnIndex));
        }
        return rowIdx + 1;
    }

    private String resolveLaboratoryName(Long laboratoryId) {
        if (laboratoryId == null) {
            return "";
        }
        return laboratoryRepository.findById(laboratoryId).map(kz.eco.laboratory.Laboratory::getName).orElse("");
    }

    private void applyColumnWidths(Sheet sheet, int columnCount) {
        for (int i = 0; i < columnCount; i++) {
            try {
                sheet.autoSizeColumn(i);
            } catch (Exception ignored) {
                // Headless font metrics can be unavailable in some environments; fall back below.
            }
            int width = sheet.getColumnWidth(i);
            int clamped = Math.max(Math.min(width, 14000), 3500);
            sheet.setColumnWidth(i, clamped);
        }
    }

    private void applyPageSetup(Sheet sheet, int columnCount) {
        PrintSetup printSetup = sheet.getPrintSetup();
        printSetup.setPaperSize(PrintSetup.A4_PAPERSIZE);
        printSetup.setLandscape(columnCount > LANDSCAPE_COLUMN_THRESHOLD);
        sheet.setFitToPage(true);
        printSetup.setFitWidth((short) 1);
        printSetup.setFitHeight((short) 0);
    }

    private CellStyle titleStyle(Workbook workbook, HorizontalAlignment alignment) {
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(alignment);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private CellStyle headerStyle(Workbook workbook) {
        Font font = workbook.createFont();
        font.setBold(true);
        CellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        applyBorders(style);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle dataCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        style.setWrapText(true);
        applyBorders(style);
        return style;
    }

    private void applyBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }
}
