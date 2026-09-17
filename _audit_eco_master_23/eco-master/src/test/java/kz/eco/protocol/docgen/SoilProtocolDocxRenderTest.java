package kz.eco.protocol.docgen;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolResult;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit test (no Spring context): renders a soil protocol straight from the real
 * template and inspects the produced DOCX text, so a regression back to the old
 * demo/placeholder generator is caught without needing to boot the app.
 */
class SoilProtocolDocxRenderTest {

    @Test
    void soilProtocol_rendersRealTemplate_noDemoOrJunkValues() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, results, null);
        String text = extractText(docx);

        assertTrue(text.contains("ПРОТОКОЛ ИСПЫТАНИЙ"), "must contain the real title: " + text);
        assertFalse(text.contains("Демонстрационный макет"), "must not contain the demo watermark text");
        assertFalse(text.toLowerCase().contains("undefined"), "must not leak 'undefined'");
        assertFalse(text.contains("null"), "must not leak the literal 'null'");
        assertFalse(text.matches("(?s).*\\bБИН\\W*a\\b.*"), "must not render 'a' as a BIN value");

        assertTrue(text.contains("ТОО «Polymettech»"), "customer name missing");
        assertTrue(text.contains("990011223344"), "customer BIN missing");
        assertTrue(text.contains("СЗЗ точка"), "object name missing");
        assertTrue(text.contains("Мышьяк"), "indicator missing");
        assertTrue(text.contains("2"), "normative value missing");
        assertTrue(text.contains("1,62"), "result value missing");
    }

    @Test
    void soilProtocol_missingOptionalFields_rendersEmDashNotJunk() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setCompanyBinSnapshot(null);
        protocol.setObjectAddressSnapshot(null);
        ProtocolResult result = buildResult();
        result.setTestingMethodNd(null);

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(result), null);
        String text = extractText(docx);

        assertFalse(text.toLowerCase().contains("undefined"));
        assertFalse(text.toLowerCase().contains("nan"));
        assertFalse(text.contains("null"));
        assertTrue(text.contains("—"), "missing fields should render as em-dash");
    }

    @Test
    void soilProtocol_resultsTable_hasBordersFontAndAlignment() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, results, null);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable resultsTable = doc.getTables().stream()
                    .filter(t -> t.getText().contains("Мышьяк"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("results table not found in generated docx"));

            var tblPr = resultsTable.getCTTbl().getTblPr();
            assertNotNull(tblPr, "table must have tblPr");
            assertNotNull(tblPr.getTblBorders(), "table must have explicit borders, otherwise it renders as invisible-grid plain text");
            assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.SINGLE,
                    tblPr.getTblBorders().getInsideH().getVal(), "must have a visible horizontal border between rows");
            assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.SINGLE,
                    tblPr.getTblBorders().getInsideV().getVal(), "must have a visible vertical border between columns");

            XWPFTableRow headerRow = resultsTable.getRow(0);
            assertEquals("Times New Roman", headerRow.getCell(0).getParagraphs().get(0).getRuns().get(0).getFontFamily(),
                    "header font must be Times New Roman");

            XWPFTableRow dataRow = resultsTable.getRow(1);
            int resultColumn = dataRow.getTableCells().size() - 1;
            assertEquals(org.apache.poi.xwpf.usermodel.ParagraphAlignment.CENTER,
                    dataRow.getCell(resultColumn).getParagraphs().get(0).getAlignment(),
                    "Результаты испытаний column must be centered");
            assertEquals(org.apache.poi.xwpf.usermodel.ParagraphAlignment.LEFT,
                    dataRow.getCell(0).getParagraphs().get(0).getAlignment(),
                    "non-result data columns must stay left-aligned");
        }
    }

    @Test
    void soilProtocol_resultsTable_spansFullPageWidthWithExplicitGrid() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, results, null);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable resultsTable = doc.getTables().stream()
                    .filter(t -> t.getText().contains("Мышьяк"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("results table not found in generated docx"));

            var tblPr = resultsTable.getCTTbl().getTblPr();
            assertNotNull(tblPr.getTblW(), "table must declare an explicit width");
            int tableWidth = ((java.math.BigInteger) tblPr.getTblW().getW()).intValue();
            assertTrue(tableWidth >= 9000,
                    "table width must span (close to) the full printable page width, not a few centimetres: " + tableWidth);

            var grid = resultsTable.getCTTbl().getTblGrid();
            assertNotNull(grid, "table must define an explicit tblGrid, otherwise Word/LibreOffice "
                    + "collapse it to a near-zero default width and wrap text one letter per line");
            assertEquals(5, grid.sizeOfGridColArray(), "grid must have one column per header");
            int gridTotal = 0;
            for (var gridCol : grid.getGridColArray()) {
                gridTotal += ((java.math.BigInteger) gridCol.getW()).intValue();
            }
            assertEquals(tableWidth, gridTotal, "sum of gridCol widths must match the declared table width");

            XWPFTableRow headerRow = resultsTable.getRow(0);
            for (int c = 0; c < 5; c++) {
                var tcPr = headerRow.getCell(c).getCTTc().getTcPr();
                assertNotNull(tcPr != null ? tcPr.getTcW() : null, "every header cell must have an explicit width");
            }
            assertTrue(headerRow.isRepeatHeader(), "header row must repeat on every new page");

            XWPFTableRow dataRow = resultsTable.getRow(1);
            assertTrue(dataRow.isCantSplitRow(), "a data row must not split across a page break");
        }
    }

    @Test
    void soilProtocol_testingMethod_fallsBackToProtocolLevelWhenRowIsBlank() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setTestingMethodNd("ГОСТ 33045-2014 \"Вода. Методы определения азотсодержащих веществ\"");
        ProtocolResult result = buildResult();
        result.setTestingMethodNd(null);

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(result), null);
        String text = extractText(docx);

        assertTrue(text.contains("ГОСТ 33045-2014"), "protocol-level testing method must fill the row when the row itself has none: " + text);
    }

    @Test
    void soilProtocol_testingMethod_rowLevelTakesPriorityOverProtocolLevel() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setTestingMethodNd("ГОСТ 33045-2014 (общий НД протокола)");
        ProtocolResult result = buildResult();
        result.setTestingMethodNd("МУ 08-47/203 (НД конкретной строки)");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(result), null);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable resultsTable = doc.getTables().stream()
                    .filter(t -> t.getText().contains("Мышьяк"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("results table not found in generated docx"));
            // Column 2 ("НД на методы испытаний") must show the row's own method, not the
            // protocol-level general one - even though the general НД legitimately also appears
            // elsewhere in the document header (the {{TESTING_METHOD_ND}} placeholder), which is
            // why this checks the table cell specifically instead of the whole document text.
            String methodCellText = resultsTable.getRow(1).getCell(2).getText();
            assertEquals("МУ 08-47/203 (НД конкретной строки)", methodCellText);
        }
    }

    @Test
    void soilProtocol_withLogo_embedsPictureInDocx() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());
        byte[] logoPng = createPngBytes(40, 20);

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, logoPng, "image/png");

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertNotNull(doc.getAllPictures(), "logo image must be embedded as a real picture in the docx");
            assertFalse(doc.getAllPictures().isEmpty(), "logo image must be embedded as a real picture in the docx");
        }
        assertFalse(extractText(docx).contains("{{LAB_LOGO}}"), "marker token must not leak into the rendered document");
    }

    @Test
    void soilProtocol_squareLogo_growsToTheNewLargerBoxWhilePreservingAspectRatio() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());
        byte[] logoPng = createPngBytes(400, 400);

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, logoPng, "image/png");

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            var logoCell = doc.getTables().get(0).getRow(0).getCell(0);
            var picture = logoCell.getParagraphs().get(0).getRuns().get(0).getEmbeddedPictures().get(0);
            var extent = picture.getCTPicture().getSpPr().getXfrm().getExt();
            double widthPt = extent.getCx() / (double) org.apache.poi.util.Units.EMU_PER_POINT;
            double heightPt = extent.getCy() / (double) org.apache.poi.util.Units.EMU_PER_POINT;

            assertTrue(widthPt > 50, "a square logo must now exceed the old 50pt height cap: " + widthPt);
            assertTrue(heightPt > 50, "a square logo must now exceed the old 50pt height cap: " + heightPt);
            assertTrue(widthPt <= 85.5, "logo must stay within the 85pt box width: " + widthPt);
            assertTrue(heightPt <= 85.5, "logo must stay within the 85pt box height: " + heightPt);
            assertEquals(widthPt, heightPt, 0.5, "a square source image must render square (aspect ratio preserved, not stretched)");
        }
    }

    @Test
    void soilProtocol_withoutLogo_rendersWithoutErrorAndNoMarkerLeak() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, null, null);

        assertFalse(extractText(docx).contains("{{LAB_LOGO}}"), "marker token must not leak into the rendered document");
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            assertTrue(doc.getAllPictures() == null || doc.getAllPictures().isEmpty(),
                    "no logo supplied -> no embedded picture, but generation must still succeed");
        }
    }

    @Test
    void soilProtocol_blankLaboratoryAddressAndAccreditation_stillRendersThreeColumnHeader() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setLaboratoryAddress(null);
        protocol.setAccreditationNumber(null);
        protocol.setAccreditationValidFrom(null);
        protocol.setAccreditationValidUntil(null);
        List<ProtocolResult> results = List.of(buildResult());
        byte[] logoPng = createPngBytes(100, 100);

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, logoPng, "image/png");

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable headerTable = doc.getTables().get(0);
            assertEquals(3, headerTable.getRow(0).getTableCells().size(),
                    "a blank address/accreditation must not collapse the 3-column header layout");
            var infoCell = headerTable.getRow(0).getCell(1);
            for (XWPFParagraph p : infoCell.getParagraphs()) {
                assertEquals(org.apache.poi.xwpf.usermodel.ParagraphAlignment.CENTER, p.getAlignment(),
                        "the middle cell must stay centered even when address/accreditation are blank");
            }
        }
    }

    @Test
    void soilProtocol_withLogo_isLeftAlignedInBorderlessHeaderTable() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());
        byte[] logoPng = createPngBytes(200, 100);

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, logoPng, "image/png");

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable headerTable = doc.getTables().get(0);
            assertEquals(3, headerTable.getRow(0).getTableCells().size(),
                    "header must contain logo, centered laboratory information and a symmetric spacer");

            var logoCell = headerTable.getRow(0).getCell(0);
            assertEquals(1, logoCell.getParagraphs().get(0).getRuns().stream()
                    .mapToInt(r -> r.getEmbeddedPictures().size()).sum(), "logo picture must be in the left cell");
            assertEquals(org.apache.poi.xwpf.usermodel.ParagraphAlignment.LEFT,
                    logoCell.getParagraphs().get(0).getAlignment(), "logo must be left-aligned, not centered");

            var infoCell = headerTable.getRow(0).getCell(1);
            assertTrue(infoCell.getText().contains("АЛАУ Сервис К"), "lab details must be in the middle cell");
            for (XWPFParagraph p : infoCell.getParagraphs()) {
                assertEquals(org.apache.poi.xwpf.usermodel.ParagraphAlignment.CENTER, p.getAlignment(),
                        "lab detail lines are centered within the middle cell");
            }

            var spacerCell = headerTable.getRow(0).getCell(2);
            assertEquals("", spacerCell.getText(), "the third (symmetric) cell must stay empty");

            int leftWidth = cellWidthTwips(logoCell);
            int centerWidth = cellWidthTwips(infoCell);
            int rightWidth = cellWidthTwips(spacerCell);
            assertEquals(leftWidth, rightWidth,
                    "first and third columns must be equal width so the middle column centers on the page, not just within itself");
            assertEquals(9920, leftWidth + centerWidth + rightWidth, "column widths must add up to the full header table width");

            var tblPr = headerTable.getCTTbl().getTblPr();
            assertNotNull(tblPr.getTblBorders(), "header table must have an explicit (empty) border spec");
            assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.NONE,
                    tblPr.getTblBorders().getTop().getVal(), "header table borders must be hidden");
            assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.NONE,
                    tblPr.getTblBorders().getInsideV().getVal());
            assertEquals(java.math.BigInteger.ZERO, ((java.math.BigInteger) tblPr.getTblInd().getW()),
                    "header table must start flush at the left margin, not indented toward the center");
        }
    }

    private static int cellWidthTwips(org.apache.poi.xwpf.usermodel.XWPFTableCell cell) {
        var tcPr = cell.getCTTc().getTcPr();
        assertNotNull(tcPr, "cell must have an explicit width");
        return ((java.math.BigInteger) tcPr.getTcW().getW()).intValue();
    }

    @Test
    void protocol_everyRunInDocumentIsTimesNewRoman12pt() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());
        byte[] logoPng = createPngBytes(200, 100);

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, results, null, logoPng, "image/png");

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            for (XWPFParagraph paragraph : doc.getParagraphs()) {
                assertRunsAreBaseFont(paragraph);
            }
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (var cell : row.getTableCells()) {
                        for (XWPFParagraph paragraph : cell.getParagraphs()) {
                            assertRunsAreBaseFont(paragraph);
                        }
                    }
                }
            }
        }
    }

    @Test
    void protocol_titleAndFieldLabels_stayBoldAt12pt() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = List.of(buildResult());

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, results, null);

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFParagraph title = doc.getParagraphs().stream()
                    .filter(p -> p.getText() != null && p.getText().contains("ПРОТОКОЛ ИСПЫТАНИЙ"))
                    .findFirst().orElseThrow();
            assertTrue(title.getRuns().get(0).isBold(), "protocol title must stay bold");
            assertEquals(12, title.getRuns().get(0).getFontSize());

            XWPFParagraph customerLine = doc.getParagraphs().stream()
                    .filter(p -> p.getText() != null && p.getText().contains("ТОО «Polymettech»"))
                    .findFirst().orElseThrow();
            assertTrue(customerLine.getRuns().get(0).isBold(), "field label run must stay bold");
            assertFalse(customerLine.getRuns().get(1).isBold(), "field value run must not be bold");
            assertEquals(12, customerLine.getRuns().get(0).getFontSize());
            assertEquals(12, customerLine.getRuns().get(1).getFontSize());
        }
    }

    private static void assertRunsAreBaseFont(XWPFParagraph paragraph) {
        for (var run : paragraph.getRuns()) {
            assertEquals("Times New Roman", run.getFontFamily(), "font must be Times New Roman: " + run.getText(0));
            assertEquals(12, run.getFontSize(), "font size must be 12pt everywhere: " + run.getText(0));
        }
    }

    private static byte[] createPngBytes(int width, int height) throws Exception {
        java.awt.image.BufferedImage image =
                new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(java.awt.Color.BLUE);
        graphics.fillRect(0, 0, width, height);
        graphics.dispose();
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static Protocol buildProtocol() {
        Protocol protocol = new Protocol();
        protocol.setTemplateCode("SOIL");
        protocol.setProtocolNumber("20");
        protocol.setProtocolDate(LocalDate.of(2026, 6, 20));
        protocol.setCompanyNameSnapshot("ТОО «Polymettech»");
        protocol.setCompanyBinSnapshot("990011223344");
        protocol.setCompanyLegalAddressSnapshot("г. Шымкент, Енбекшинский район");
        protocol.setObjectNameSnapshot("СЗЗ точка №1");
        protocol.setObjectAddressSnapshot("г. Алматы, промзона");
        protocol.setProductName("почва");
        protocol.setBasisForTesting("договор");
        protocol.setSamplingLocationSnapshot("Проба №1");
        protocol.setSamplingMethodNd("СТ РК ИСО 11047-2008");
        protocol.setSampleDate(LocalDate.of(2026, 6, 16));
        protocol.setTestingStartDate(LocalDate.of(2026, 6, 16));
        protocol.setTestingEndDate(LocalDate.of(2026, 6, 20));
        protocol.setLaboratoryName("ТОО «АЛАУ Сервис К»");
        protocol.setLaboratoryAddress("г. Шымкент, ул. Темир Казык, 132");
        protocol.setAccreditationNumber("KZ.T.16.E0424");
        protocol.setAccreditationValidFrom(LocalDate.of(2021, 8, 20));
        protocol.setAccreditationValidUntil(LocalDate.of(2026, 8, 20));
        protocol.setExecutorName("Жолдасбеков Е.Г.");
        protocol.setHeadOfLaboratoryName("Буртебаев Е.А.");
        return protocol;
    }

    private static ProtocolResult buildResult() {
        ProtocolResult result = new ProtocolResult();
        result.setRowNumber(1);
        result.setObjectName("Проба №1");
        result.setIndicatorName("Мышьяк");
        result.setUnit("мг/кг");
        result.setTestingMethodNd("МУ 08-47/203");
        result.setNormativeValue(new BigDecimal("2.0"));
        result.setResultValue(new BigDecimal("1.62"));
        result.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        return result;
    }

    private static String extractText(byte[] docx) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            StringBuilder sb = new StringBuilder();
            for (XWPFParagraph p : doc.getParagraphs()) {
                sb.append(p.getText()).append('\n');
            }
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (var cell : row.getTableCells()) {
                        sb.append(cell.getText()).append(" | ");
                    }
                    sb.append('\n');
                }
            }
            return sb.toString();
        }
    }
}
