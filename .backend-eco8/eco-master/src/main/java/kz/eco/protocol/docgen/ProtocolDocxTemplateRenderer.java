package kz.eco.protocol.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolEnvironmentConditions;
import kz.eco.protocol.ProtocolResult;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.apache.xmlbeans.XmlCursor;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblBorders;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblGrid;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblLayoutType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTblWidth;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblLayoutType;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblWidth;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Renders a protocol into its real laboratory DOCX template: loads the classpath template
 * for the resolved {@link ProtocolTemplateKey}, replaces {{PLACEHOLDER}} tokens, and expands
 * the {{RESULTS_TABLE}} marker into a results table with the column set that matches the
 * template's real-world column set (soil vs the generic место/показатель/норма/результат set).
 */
public final class ProtocolDocxTemplateRenderer {

    static final String RESULTS_TABLE_MARKER = "{{RESULTS_TABLE}}";
    static final String LAB_LOGO_MARKER = "{{LAB_LOGO}}";
    static final String LAB_ADDRESS_MARKER = "{{LAB_ADDRESS}}";

    /** Base font for the whole document per spec: everything renders Times New Roman 12pt,
     * including the results table - only bold/alignment vary between labels and values. */
    private static final String BASE_FONT = "Times New Roman";
    private static final int BASE_FONT_SIZE = 12;

    /** Logos are fit inside this square box (in points, 1pt = 1/72 inch), preserving aspect
     * ratio. 85x85pt is roughly 30x30mm - a square logo (the common case) now actually reaches
     * the requested 28-30mm instead of being capped by a short 50pt height limit. */
    private static final int LOGO_MAX_WIDTH_PT = 85;
    private static final int LOGO_MAX_HEIGHT_PT = 85;

    /**
     * All templates share pgMar left=1134 right=850 twips on an A4 page (11906 twips wide), so
     * the real printable width is 11906 - 1134 - 850 = 9922 twips. Both tables below must stay
     * at or under that, or they visibly overflow the right margin.
     */
    private static final int PRINTABLE_WIDTH_TWIPS = 9922;

    /** Column widths (twips/DXA) for the 5-column results table - see applyColumnWidths javadoc
     * for why an explicit tblGrid (not just tblW/tcW) is required. */
    private static final int[] RESULT_COLUMN_WIDTHS_TWIPS = {1750, 2900, 2350, 1350, 1570};
    private static final int RESULT_TABLE_WIDTH_TWIPS = 9920;

    /**
     * Logo | lab details | symmetric spacer. The first and third columns are equal width so the
     * middle column's own center lands exactly on the page's center - a plain 2-column
     * logo|details split centers text only within the details column, which sits well right of
     * the page's true center once the logo column is subtracted. The spacer column carries no
     * content (see prepareHeaderSpacerCell).
     */
    private static final int[] HEADER_COLUMN_WIDTHS_TWIPS = {2200, 5520, 2200};
    private static final int HEADER_TABLE_WIDTH_TWIPS = 9920;

    private static final String[] SOIL_HEADERS = {
            "Наименование продукции (объекта)",
            "Наименование определяемых показателей",
            "НД на методы испытаний",
            "Нормативы (ПДК), не более",
            "Результаты испытаний"
    };

    private static final String[] GENERIC_HEADERS = {
            "Место отбора",
            "Наименование определяемых показателей, ед. измерения",
            "НД на методы испытаний",
            "Норма по НД",
            "Результаты испытаний"
    };

    private ProtocolDocxTemplateRenderer() {
    }

    public static byte[] loadTemplate(ProtocolTemplateKey key) throws IOException {
        String resourcePath = key.classpathLocation();
        try (InputStream stream = ProtocolDocxTemplateRenderer.class.getClassLoader().getResourceAsStream(resourcePath)) {
            if (stream == null) {
                throw new BadRequestException("Шаблон протокола не найден: " + resourcePath);
            }
            return stream.readAllBytes();
        }
    }

    public static byte[] render(ProtocolTemplateKey key,
                                Protocol protocol,
                                List<ProtocolResult> results,
                                ProtocolEnvironmentConditions environment) throws IOException {
        return render(key, protocol, results, environment, null, null);
    }

    /**
     * @param logoBytes       raw bytes of the laboratory logo image, or null/empty if the
     *                        laboratory has none - the {{LAB_LOGO}} marker is then left blank
     *                        rather than failing generation (requirement: a missing logo must
     *                        never break the document).
     * @param logoContentType the logo's MIME type (image/png or image/jpeg); anything else is
     *                        silently skipped since Word/POI picture embedding needs a known type.
     */
    public static byte[] render(ProtocolTemplateKey key,
                                Protocol protocol,
                                List<ProtocolResult> results,
                                ProtocolEnvironmentConditions environment,
                                byte[] logoBytes,
                                String logoContentType) throws IOException {
        byte[] templateBytes = loadTemplate(key);
        try (InputStream in = new ByteArrayInputStream(templateBytes);
             XWPFDocument doc = new XWPFDocument(in);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Must run before placeholder replacement: it moves the {{LAB_NAME}}../{{LAB_ADDRESS}}
            // paragraphs into a table cell, and the replacement pass below already walks every
            // table cell in the document, so the placeholders inside get filled in either way.
            restructureLogoHeader(doc, logoBytes, logoContentType);

            // A field the user hid via ProtocolPrintVisibility must not just print blank next to
            // its label - the whole label+value line is removed. Must run before the placeholder
            // text substitution below, while {{TOKEN}} markers are still literally present to scan
            // for. A line that carries two independently-toggleable fields (e.g. customer name +
            // address on one line) is only dropped once ALL of its controlled tokens are hidden.
            removeHiddenPrintVisibilityParagraphs(doc, ProtocolDocxPlaceholders.fullyHiddenTokens(protocol));

            Map<String, String> placeholders = ProtocolDocxPlaceholders.build(protocol, environment);
            replaceInParagraphs(doc.getParagraphs(), placeholders);
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        replaceInParagraphs(cell.getParagraphs(), placeholders);
                    }
                }
            }
            insertResultsTable(doc, key, protocol, results);
            appendMeasurementDeviceBlock(doc, results);
            // Last step: whatever bold/alignment a run ended up with, force it onto Times New
            // Roman 12pt - the one base font/size the whole protocol must render in. Word can
            // leave a replaced run's font inconsistent with the rest of the paragraph, and
            // reader default styles/theme fonts vary, so this is applied unconditionally rather
            // than trusting the template's own runs to already be correct.
            normalizeDocumentFont(doc);
            doc.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Turns the standalone {{LAB_LOGO}} .. {{LAB_ADDRESS}} paragraph block (see class javadoc)
     * into a real 3-column, borderless table: logo left-aligned in a narrow left cell, the
     * laboratory's name/accreditation/address centered in the middle cell, and an empty spacer
     * cell on the right that mirrors the logo cell's width. This replaces the old "centered logo
     * paragraph above centered lab name" layout, which put the logo in the middle of the page
     * instead of the letterhead-standard top-left position - and also replaces an intermediate
     * 2-column logo|details layout, which only centered text within the details column (i.e.
     * right of the page's true center) rather than the page as a whole. With symmetric first/
     * third columns, the middle column's center coincides with the page's center.
     */
    private static void restructureLogoHeader(XWPFDocument doc, byte[] logoBytes, String logoContentType) {
        XWPFParagraph logoMarker = findMarkerParagraph(doc, LAB_LOGO_MARKER);
        if (logoMarker == null) {
            return;
        }
        List<XWPFParagraph> bodyParagraphs = doc.getParagraphs();
        int markerIndex = bodyParagraphs.indexOf(logoMarker);
        List<XWPFParagraph> infoParagraphs = new ArrayList<>();
        boolean foundAddress = false;
        for (int i = markerIndex + 1; i < bodyParagraphs.size(); i++) {
            XWPFParagraph paragraph = bodyParagraphs.get(i);
            infoParagraphs.add(paragraph);
            if (paragraph.getText() != null && paragraph.getText().contains(LAB_ADDRESS_MARKER)) {
                foundAddress = true;
                break;
            }
        }
        if (!foundAddress) {
            // Template doesn't have the expected letterhead block - don't guess, just drop the
            // marker text so "{{LAB_LOGO}}" never leaks into the rendered document.
            clearRuns(logoMarker);
            return;
        }

        XmlCursor cursor = logoMarker.getCTP().newCursor();
        XWPFTable headerTable = doc.insertNewTbl(cursor);
        while (headerTable.getNumberOfRows() < 1) {
            headerTable.createRow();
        }
        XWPFTableRow row = headerTable.getRow(0);
        while (row.getTableCells().size() < 3) {
            row.createCell();
        }
        XWPFTableCell logoCell = row.getCell(0);
        XWPFTableCell infoCell = row.getCell(1);
        XWPFTableCell spacerCell = row.getCell(2);

        populateLogoCell(logoCell, logoBytes, logoContentType);
        populateInfoCell(infoCell, infoParagraphs);
        prepareHeaderSpacerCell(spacerCell);

        applyHeaderTableLayout(headerTable);

        removeParagraph(doc, logoMarker);
        for (XWPFParagraph paragraph : infoParagraphs) {
            removeParagraph(doc, paragraph);
        }
    }

    private static void populateLogoCell(XWPFTableCell cell, byte[] logoBytes, String logoContentType) {
        XWPFParagraph paragraph = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphArray(0);
        paragraph.setAlignment(ParagraphAlignment.LEFT);
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        if (logoBytes == null || logoBytes.length == 0) {
            return;
        }
        int pictureType = resolvePictureType(logoContentType);
        if (pictureType < 0) {
            return;
        }
        int[] size = resolveLogoSizePoints(logoBytes);
        try (InputStream imageStream = new ByteArrayInputStream(logoBytes)) {
            XWPFRun run = paragraph.createRun();
            run.addPicture(imageStream, pictureType, "laboratory-logo",
                    Units.toEMU(size[0]), Units.toEMU(size[1]));
        } catch (IOException | InvalidFormatException ex) {
            // Corrupt/unreadable logo bytes - leave the cell blank instead of failing generation.
        }
    }

    /** Copies each source paragraph's runs (text + bold) into the info cell, one target
     * paragraph per source paragraph, centered - font/size is normalized later for the whole
     * document, so only text/bold need to survive the move. Left/right indentation is pinned to
     * zero and line spacing kept compact so the block stays visually centered on the page rather
     * than drifting off-center under a template style's default paragraph indent. */
    private static void populateInfoCell(XWPFTableCell cell, List<XWPFParagraph> sourceParagraphs) {
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        for (int i = 0; i < sourceParagraphs.size(); i++) {
            XWPFParagraph source = sourceParagraphs.get(i);
            XWPFParagraph target = i == 0 && !cell.getParagraphs().isEmpty()
                    ? cell.getParagraphArray(0) : cell.addParagraph();
            target.setAlignment(ParagraphAlignment.CENTER);
            target.setSpacingBefore(0);
            target.setSpacingAfter(0);
            target.setSpacingBetween(1.0, LineSpacingRule.AUTO);
            target.setIndentationLeft(0);
            target.setIndentationRight(0);
            for (XWPFRun sourceRun : source.getRuns()) {
                String text = sourceRun.getText(0);
                if (text == null) {
                    continue;
                }
                XWPFRun targetRun = target.createRun();
                targetRun.setBold(sourceRun.isBold());
                targetRun.setText(text);
            }
        }
    }

    /**
     * The empty third column that mirrors the logo column's width so the details column's center
     * lands on the page's center. Must render as a genuinely blank cell: no text, no leftover
     * runs, no extra paragraph, default (left) alignment so it never accidentally centers a
     * phantom empty line into visible whitespace.
     */
    private static void prepareHeaderSpacerCell(XWPFTableCell cell) {
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);

        XWPFParagraph paragraph = cell.getParagraphs().isEmpty()
                ? cell.addParagraph()
                : cell.getParagraphArray(0);

        paragraph.setAlignment(ParagraphAlignment.LEFT);
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);

        clearRuns(paragraph);
    }

    /** Borderless, fixed-layout, flush against the left margin - a letterhead table, not a
     * visible grid. */
    private static void applyHeaderTableLayout(XWPFTable table) {
        CTTblPr tblPr = ensureTblPr(table);
        CTTblWidth tableWidth = tblPr.isSetTblW() ? tblPr.getTblW() : tblPr.addNewTblW();
        tableWidth.setType(STTblWidth.DXA);
        tableWidth.setW(BigInteger.valueOf(HEADER_TABLE_WIDTH_TWIPS));
        CTTblLayoutType layout = tblPr.isSetTblLayout() ? tblPr.getTblLayout() : tblPr.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);

        CTTblGrid grid = table.getCTTbl().getTblGrid() != null
                ? table.getCTTbl().getTblGrid() : table.getCTTbl().addNewTblGrid();
        while (grid.sizeOfGridColArray() > 0) {
            grid.removeGridCol(0);
        }
        for (int width : HEADER_COLUMN_WIDTHS_TWIPS) {
            grid.addNewGridCol().setW(BigInteger.valueOf(width));
        }

        for (int c = 0; c < HEADER_COLUMN_WIDTHS_TWIPS.length; c++) {
            XWPFTableCell cell = table.getRow(0).getCell(c);
            CTTblWidth cellWidth = cell.getCTTc().isSetTcPr()
                    ? cell.getCTTc().getTcPr().addNewTcW() : cell.getCTTc().addNewTcPr().addNewTcW();
            cellWidth.setType(STTblWidth.DXA);
            cellWidth.setW(BigInteger.valueOf(HEADER_COLUMN_WIDTHS_TWIPS[c]));
        }

        removeTableBorders(table);
        applyTablePlacement(table);
    }

    /** Explicit "no border" (not just same-color-as-background) on every edge, otherwise some
     * renderers fall back to a default single-line grid for a table with no border spec at all. */
    private static void removeTableBorders(XWPFTable table) {
        CTTblPr tblPr = ensureTblPr(table);
        CTTblBorders borders = tblPr.isSetTblBorders() ? tblPr.getTblBorders() : tblPr.addNewTblBorders();
        clearBorder(borders.isSetTop() ? borders.getTop() : borders.addNewTop());
        clearBorder(borders.isSetBottom() ? borders.getBottom() : borders.addNewBottom());
        clearBorder(borders.isSetLeft() ? borders.getLeft() : borders.addNewLeft());
        clearBorder(borders.isSetRight() ? borders.getRight() : borders.addNewRight());
        clearBorder(borders.isSetInsideH() ? borders.getInsideH() : borders.addNewInsideH());
        clearBorder(borders.isSetInsideV() ? borders.getInsideV() : borders.addNewInsideV());
    }

    private static void clearBorder(org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder border) {
        border.setVal(STBorder.NONE);
        border.setSz(BigInteger.ZERO);
        border.setSpace(BigInteger.ZERO);
    }

    private static void clearRuns(XWPFParagraph paragraph) {
        while (!paragraph.getRuns().isEmpty()) {
            paragraph.removeRun(0);
        }
    }

    /** Forces Times New Roman 12pt on every run in the document - main body paragraphs and every
     * table cell (results table, header table, and any other table the template happens to
     * have) - without touching bold/italic/alignment, which carry the semantic distinction
     * between field labels and their values. */
    private static void normalizeDocumentFont(XWPFDocument doc) {
        for (XWPFParagraph paragraph : doc.getParagraphs()) {
            applyBaseFont(paragraph);
        }
        for (XWPFTable table : doc.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph paragraph : cell.getParagraphs()) {
                        applyBaseFont(paragraph);
                    }
                }
            }
        }
    }

    private static void applyBaseFont(XWPFParagraph paragraph) {
        for (XWPFRun run : paragraph.getRuns()) {
            run.setFontFamily(BASE_FONT);
            run.setFontSize(BASE_FONT_SIZE);
            // setFontFamily/setFontSize above already guarantee rPr exists. rFonts is modelled as
            // a repeated element in this XMLBeans binding (no singular getRFonts()/isSetRFonts()),
            // so reuse array slot 0 if present instead of appending a duplicate <w:rFonts>.
            var rPr = run.getCTR().isSetRPr() ? run.getCTR().getRPr() : run.getCTR().addNewRPr();
            var rFonts = rPr.sizeOfRFontsArray() > 0 ? rPr.getRFontsArray(0) : rPr.addNewRFonts();
            rFonts.setAscii(BASE_FONT);
            rFonts.setHAnsi(BASE_FONT);
            rFonts.setEastAsia(BASE_FONT);
            rFonts.setCs(BASE_FONT);
        }
    }

    private static void replaceInParagraphs(List<XWPFParagraph> paragraphs, Map<String, String> placeholders) {
        for (XWPFParagraph paragraph : paragraphs) {
            replaceText(paragraph, placeholders);
        }
    }

    /**
     * Replaces placeholder tokens run-by-run first, so a bold label run next to a plain
     * value run keeps its formatting. Falls back to collapsing the whole paragraph into a
     * single run only if a token was split across runs (e.g. by Word's autocorrect) and
     * survived the per-run pass.
     */
    private static void replaceText(XWPFParagraph paragraph, Map<String, String> placeholders) {
        String text = paragraph.getText();
        if (text == null || text.isBlank() || !text.contains("{{")) {
            return;
        }
        for (XWPFRun run : paragraph.getRuns()) {
            String runText = run.getText(0);
            if (runText == null || !runText.contains("{{")) {
                continue;
            }
            String replaced = applyAll(runText, placeholders);
            if (!replaced.equals(runText)) {
                run.setText(replaced, 0);
            }
        }

        String remaining = paragraph.getText();
        if (remaining == null || !remaining.contains("{{")) {
            return;
        }
        String replaced = applyAll(remaining, placeholders);
        if (!replaced.equals(remaining)) {
            int runCount = paragraph.getRuns().size();
            for (int i = runCount - 1; i >= 0; i--) {
                paragraph.removeRun(i);
            }
            XWPFRun run = paragraph.createRun();
            run.setText(replaced);
        }
    }

    private static String applyAll(String text, Map<String, String> placeholders) {
        String replaced = text;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            replaced = replaced.replace(entry.getKey(), entry.getValue());
        }
        return replaced;
    }

    private static void insertResultsTable(XWPFDocument doc, ProtocolTemplateKey key, Protocol protocol,
                                            List<ProtocolResult> results) {
        XWPFParagraph markerParagraph = findMarkerParagraph(doc);
        String[] headers = key.columnSet() == ProtocolTemplateKey.ResultColumnSet.SOIL ? SOIL_HEADERS : GENERIC_HEADERS;
        int rowCount = Math.max(results.size(), 1) + 1;

        XWPFTable table;
        if (markerParagraph != null) {
            XmlCursor cursor = markerParagraph.getCTP().newCursor();
            table = doc.insertNewTbl(cursor);
        } else {
            table = doc.createTable();
        }
        // The freshly inserted table starts as 1x1; grow it to the shape we need.
        while (table.getNumberOfRows() < rowCount) {
            table.createRow();
        }
        for (int r = 0; r < rowCount; r++) {
            XWPFTableRow row = table.getRow(r);
            while (row.getTableCells().size() < headers.length) {
                row.createCell();
            }
        }

        // Last column ("Результаты испытаний") is centered; every other data column is
        // left-aligned; the header row is centered throughout.
        int resultColumn = headers.length - 1;

        for (int c = 0; c < headers.length; c++) {
            setCellText(table.getRow(0).getCell(c), headers[c], true, ParagraphAlignment.CENTER);
        }

        if (results.isEmpty()) {
            for (int c = 0; c < headers.length; c++) {
                setCellText(table.getRow(1).getCell(c), ProtocolDocValues.EMPTY, false,
                        c == resultColumn ? ParagraphAlignment.CENTER : ParagraphAlignment.LEFT);
            }
        } else {
            for (int i = 0; i < results.size(); i++) {
                ProtocolResult result = results.get(i);
                Map<String, Object> values = ProtocolDocValues.valuesOf(result);
                XWPFTableRow row = table.getRow(i + 1);
                setCellText(row.getCell(0), placeCellValue(key, result), false, ParagraphAlignment.LEFT);
                setCellText(row.getCell(1), ProtocolDocValues.resolveIndicatorWithUnit(result), false, ParagraphAlignment.LEFT);
                setCellText(row.getCell(2), ProtocolDocValues.resolveTestingMethod(result, values, protocol), false, ParagraphAlignment.LEFT);
                setCellText(row.getCell(3), ProtocolDocValues.resolveNorm(result, values), false, ParagraphAlignment.LEFT);
                setCellText(row.getCell(4), ProtocolDocValues.resolveResult(result), false, ParagraphAlignment.CENTER);
            }
        }

        applyColumnWidths(table, headers.length);
        applyTableBorders(table);
        applyTablePlacement(table);
        applyRowPagination(table);

        if (markerParagraph != null) {
            removeParagraph(doc, markerParagraph);
        }
    }

    /**
     * Appends an "Использованное оборудование" block listing every distinct measurement device
     * used across the protocol's results, one line per device (deduplicated by name+serial). Reads
     * only the immutable snapshot each result already carries in valuesJson (see
     * ProtocolService.deviceSnapshot) - never a live measurement_devices lookup - so a later edit
     * to the device catalog can never change what an already-issued protocol reports, and listing
     * results never needs an extra query. No-op if no result carries a device.
     */
    private static void appendMeasurementDeviceBlock(XWPFDocument doc, List<ProtocolResult> results) {
        List<String> lines = distinctDeviceLines(results);
        if (lines.isEmpty()) {
            return;
        }
        XWPFParagraph heading = doc.createParagraph();
        heading.setSpacingBefore(200);
        XWPFRun headingRun = heading.createRun();
        headingRun.setBold(true);
        headingRun.setText("Использованное оборудование:");
        int i = 1;
        for (String line : lines) {
            XWPFParagraph paragraph = doc.createParagraph();
            XWPFRun run = paragraph.createRun();
            run.setText((i++) + ". " + line);
        }
    }

    private static List<String> distinctDeviceLines(List<ProtocolResult> results) {
        java.util.LinkedHashMap<String, String> byKey = new java.util.LinkedHashMap<>();
        for (ProtocolResult result : results) {
            Map<String, Object> values = ProtocolDocValues.valuesOf(result);
            Object name = values.get("measurementDeviceName");
            if (name == null || String.valueOf(name).isBlank()) {
                continue;
            }
            String model = stringOrNull(values.get("measurementDeviceModel"));
            String serial = stringOrNull(values.get("measurementDeviceSerialNumber"));
            String verificationUntil = stringOrNull(values.get("measurementDeviceVerificationValidUntil"));
            String key = name + "|" + (serial != null ? serial : "");
            if (byKey.containsKey(key)) {
                continue;
            }
            StringBuilder sb = new StringBuilder(String.valueOf(name));
            if (model != null && !model.equalsIgnoreCase(String.valueOf(name))) {
                sb.append(" (").append(model).append(")");
            }
            if (serial != null) {
                sb.append(", зав. №").append(serial);
            }
            if (verificationUntil != null) {
                sb.append(", поверка действительна до ").append(formatIsoDate(verificationUntil));
            }
            sb.append(".");
            byKey.put(key, sb.toString());
        }
        return new ArrayList<>(byKey.values());
    }

    private static String stringOrNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static String formatIsoDate(String isoDate) {
        try {
            return ProtocolDocValues.formatDate(java.time.LocalDate.parse(isoDate));
        } catch (Exception ex) {
            return isoDate;
        }
    }

    /** Header row repeats on every new page; data rows must not split across a page break -
     * the table itself may still flow onto following pages. */
    private static void applyRowPagination(XWPFTable table) {
        for (int r = 0; r < table.getNumberOfRows(); r++) {
            XWPFTableRow row = table.getRow(r);
            row.setCantSplitRow(true);
            row.setRepeatHeader(r == 0);
        }
    }

    /** Table starts flush at the left margin with no extra indent. */
    private static void applyTablePlacement(XWPFTable table) {
        table.setTableAlignment(TableRowAlign.LEFT);
        CTTblPr tblPr = ensureTblPr(table);
        CTTblWidth indent = tblPr.isSetTblInd() ? tblPr.getTblInd() : tblPr.addNewTblInd();
        indent.setType(STTblWidth.DXA);
        indent.setW(BigInteger.ZERO);
    }

    private static String placeCellValue(ProtocolTemplateKey key, ProtocolResult result) {
        if (key.columnSet() == ProtocolTemplateKey.ResultColumnSet.SOIL) {
            return ProtocolDocValues.firstNonBlank(result.getObjectName(), result.getSampleName(), result.getSamplingPlace());
        }
        return ProtocolDocValues.firstNonBlank(result.getMeasurementPlace(), result.getSamplingPlace(), result.getRoomOrWorkplace());
    }

    private static XWPFParagraph findMarkerParagraph(XWPFDocument doc) {
        return findMarkerParagraph(doc, RESULTS_TABLE_MARKER);
    }

    private static XWPFParagraph findMarkerParagraph(XWPFDocument doc, String marker) {
        for (XWPFParagraph paragraph : doc.getParagraphs()) {
            if (paragraph.getText() != null && paragraph.getText().contains(marker)) {
                return paragraph;
            }
        }
        return null;
    }

    private static int resolvePictureType(String contentType) {
        if (contentType == null) {
            return -1;
        }
        String lower = contentType.toLowerCase();
        if (lower.contains("png")) {
            return XWPFDocument.PICTURE_TYPE_PNG;
        }
        if (lower.contains("jpeg") || lower.contains("jpg")) {
            return XWPFDocument.PICTURE_TYPE_JPEG;
        }
        return -1;
    }

    /** Scales the decoded image to fit inside the logo box while preserving aspect ratio;
     * falls back to the box size itself if the bytes can't be decoded as an image. */
    private static int[] resolveLogoSizePoints(byte[] logoBytes) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(logoBytes));
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                return new int[]{LOGO_MAX_WIDTH_PT, LOGO_MAX_HEIGHT_PT};
            }
            double scale = Math.min(
                    (double) LOGO_MAX_WIDTH_PT / image.getWidth(),
                    (double) LOGO_MAX_HEIGHT_PT / image.getHeight());
            int width = Math.max(1, (int) Math.round(image.getWidth() * scale));
            int height = Math.max(1, (int) Math.round(image.getHeight() * scale));
            return new int[]{width, height};
        } catch (IOException ex) {
            return new int[]{LOGO_MAX_WIDTH_PT, LOGO_MAX_HEIGHT_PT};
        }
    }

    private static void removeParagraph(XWPFDocument doc, XWPFParagraph paragraph) {
        int pos = doc.getPosOfParagraph(paragraph);
        if (pos >= 0) {
            doc.removeBodyElement(pos);
        }
    }

    /**
     * Drops every body paragraph and table-cell paragraph whose ProtocolPrintVisibility-controlled
     * tokens are ALL hidden - see ProtocolDocxPlaceholders.PRINT_VISIBILITY_CONTROLLED_TOKENS.
     * A paragraph with no controlled token, or with at least one controlled token that's still
     * visible, is left alone (its value substitution, including a blanked hidden sibling token on
     * the same line, happens later in the normal replaceInParagraphs pass).
     */
    private static void removeHiddenPrintVisibilityParagraphs(XWPFDocument doc, Set<String> hiddenTokens) {
        if (hiddenTokens.isEmpty()) {
            return;
        }
        for (XWPFParagraph paragraph : new ArrayList<>(doc.getParagraphs())) {
            if (shouldDropParagraph(paragraph.getText(), hiddenTokens)) {
                removeParagraph(doc, paragraph);
            }
        }
        for (XWPFTable table : doc.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph paragraph : new ArrayList<>(cell.getParagraphs())) {
                        if (shouldDropParagraph(paragraph.getText(), hiddenTokens)) {
                            int pos = cell.getParagraphs().indexOf(paragraph);
                            if (pos >= 0) {
                                cell.removeParagraph(pos);
                            }
                        }
                    }
                }
            }
        }
    }

    private static boolean shouldDropParagraph(String text, Set<String> hiddenTokens) {
        if (text == null || !text.contains("{{")) {
            return false;
        }
        boolean hasControlledToken = false;
        for (String token : ProtocolDocxPlaceholders.PRINT_VISIBILITY_CONTROLLED_TOKENS) {
            if (text.contains(token)) {
                hasControlledToken = true;
                if (!hiddenTokens.contains(token)) {
                    return false;
                }
            }
        }
        return hasControlledToken;
    }

    private static void setCellText(XWPFTableCell cell, String text, boolean header, ParagraphAlignment alignment) {
        while (cell.getParagraphs().size() > 1) {
            cell.removeParagraph(cell.getParagraphs().size() - 1);
        }
        XWPFParagraph paragraph = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphArray(0);
        while (!paragraph.getRuns().isEmpty()) {
            paragraph.removeRun(0);
        }
        paragraph.setAlignment(alignment);
        paragraph.setSpacingBefore(0);
        paragraph.setSpacingAfter(0);
        paragraph.setSpacingBetween(1.0, LineSpacingRule.AUTO);
        // Word wraps text inside a table cell by default as long as the cell has an explicit
        // width (see applyColumnWidths) and isn't marked "no wrap" - true here, so no extra
        // w:noWrap handling is needed for long indicator names to break onto multiple lines.
        cell.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
        XWPFRun run = paragraph.createRun();
        run.setBold(header);
        run.setFontFamily(BASE_FONT);
        run.setFontSize(BASE_FONT_SIZE);
        run.setText(text != null ? text : ProtocolDocValues.EMPTY);
    }

    /**
     * Pins the table to a real 100%-of-page-width fixed layout in DXA (twips). tblW/tcW alone
     * are not sufficient under tblLayout=FIXED: Word and LibreOffice actually lay the columns
     * out from tblGrid/gridCol, and POI never sets one on a freshly created/inserted table
     * (getTblGrid() is null). Without an explicit grid matching the real column count, both
     * renderers fall back to a near-zero default width and the table collapses to a few
     * centimetres with text wrapping one letter per line - the bug this method fixes.
     */
    private static void applyColumnWidths(XWPFTable table, int columns) {
        int[] widths = columns == RESULT_COLUMN_WIDTHS_TWIPS.length
                ? RESULT_COLUMN_WIDTHS_TWIPS
                : evenSplitTwips(columns);
        int totalWidth = 0;
        for (int width : widths) {
            totalWidth += width;
        }

        CTTblPr tblPr = ensureTblPr(table);
        CTTblWidth tableWidth = tblPr.isSetTblW() ? tblPr.getTblW() : tblPr.addNewTblW();
        tableWidth.setType(STTblWidth.DXA);
        tableWidth.setW(BigInteger.valueOf(totalWidth));
        CTTblLayoutType layout = tblPr.isSetTblLayout() ? tblPr.getTblLayout() : tblPr.addNewTblLayout();
        layout.setType(STTblLayoutType.FIXED);

        CTTblGrid grid = table.getCTTbl().getTblGrid() != null
                ? table.getCTTbl().getTblGrid() : table.getCTTbl().addNewTblGrid();
        while (grid.sizeOfGridColArray() > 0) {
            grid.removeGridCol(0);
        }
        for (int width : widths) {
            grid.addNewGridCol().setW(BigInteger.valueOf(width));
        }

        for (XWPFTableRow row : table.getRows()) {
            for (int c = 0; c < columns && c < row.getTableCells().size(); c++) {
                CTTblWidth width = row.getCell(c).getCTTc().isSetTcPr()
                        ? row.getCell(c).getCTTc().getTcPr().addNewTcW()
                        : row.getCell(c).getCTTc().addNewTcPr().addNewTcW();
                width.setType(STTblWidth.DXA);
                width.setW(BigInteger.valueOf(widths[c]));
            }
        }
    }

    private static int[] evenSplitTwips(int columns) {
        int[] widths = new int[columns];
        int share = RESULT_TABLE_WIDTH_TWIPS / Math.max(columns, 1);
        java.util.Arrays.fill(widths, share);
        return widths;
    }

    /** Single-line black borders on every edge and between rows/columns - see class javadoc: a
     * freshly created XWPFTable has no border definition of its own and no template table to
     * inherit one from, so without this the "table" renders as invisible-grid plain text. */
    private static void applyTableBorders(XWPFTable table) {
        CTTblPr tblPr = ensureTblPr(table);
        CTTblBorders borders = tblPr.isSetTblBorders() ? tblPr.getTblBorders() : tblPr.addNewTblBorders();
        applyBorder(borders.isSetTop() ? borders.getTop() : borders.addNewTop());
        applyBorder(borders.isSetBottom() ? borders.getBottom() : borders.addNewBottom());
        applyBorder(borders.isSetLeft() ? borders.getLeft() : borders.addNewLeft());
        applyBorder(borders.isSetRight() ? borders.getRight() : borders.addNewRight());
        applyBorder(borders.isSetInsideH() ? borders.getInsideH() : borders.addNewInsideH());
        applyBorder(borders.isSetInsideV() ? borders.getInsideV() : borders.addNewInsideV());
    }

    private static CTTblPr ensureTblPr(XWPFTable table) {
        CTTblPr existing = table.getCTTbl().getTblPr();
        return existing != null ? existing : table.getCTTbl().addNewTblPr();
    }

    private static void applyBorder(org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBorder border) {
        border.setVal(STBorder.SINGLE);
        border.setSz(BigInteger.valueOf(4));
        border.setSpace(BigInteger.ZERO);
        border.setColor("000000");
    }
}
