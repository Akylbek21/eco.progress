package kz.eco.protocol.docgen;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolResult;
import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Sweeps every real protocol template (all 8 ProtocolTemplateKey entries, i.e. the "seven types"
 * from the ticket plus the shared physical-factors template) to prove the letterhead
 * restructuring and the Times New Roman 12pt normalization apply uniformly, not just to the one
 * template exercised by SoilProtocolDocxRenderTest.
 */
class AllTemplatesHeaderAndFontTest {

    @Test
    void everyTemplate_rendersWithLeftLogoAndUniform12ptFont() throws Exception {
        byte[] logoPng = createPngBytes(200, 100);

        for (ProtocolTemplateKey key : ProtocolTemplateKey.values()) {
            Protocol protocol = buildProtocol();
            ProtocolResult result = buildResult();

            byte[] docx = ProtocolDocxTemplateRenderer.render(key, protocol, List.of(result), null, logoPng, "image/png");

            try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
                assertFalse(doc.getTables().isEmpty(), key + ": must have at least the header table");
                XWPFTable headerTable = doc.getTables().get(0);
                assertEquals(3, headerTable.getRow(0).getTableCells().size(),
                        key + ": header must contain logo, centered laboratory information and symmetric spacer");

                var logoCell = headerTable.getRow(0).getCell(0);
                int pictureCount = logoCell.getParagraphs().get(0).getRuns().stream()
                        .mapToInt(r -> r.getEmbeddedPictures().size()).sum();
                assertEquals(1, pictureCount, key + ": logo picture must land in the left header cell");
                assertEquals(ParagraphAlignment.LEFT, logoCell.getParagraphs().get(0).getAlignment(),
                        key + ": logo must be left-aligned");

                var infoCell = headerTable.getRow(0).getCell(1);
                assertTrue(infoCell.getText().contains("АЛАУ Сервис К"), key + ": laboratory name must be in the middle cell");
                assertTrue(infoCell.getText().contains("KZ.T.16.E0424"), key + ": accreditation number must be in the middle cell");
                assertTrue(infoCell.getText().contains("Темир Казык"), key + ": laboratory address must be in the middle cell");
                for (XWPFParagraph p : infoCell.getParagraphs()) {
                    assertEquals(ParagraphAlignment.CENTER, p.getAlignment(),
                            key + ": every middle-cell paragraph must be centered");
                }

                var spacerCell = headerTable.getRow(0).getCell(2);
                assertEquals("", spacerCell.getText(), key + ": third (symmetric) cell must stay empty");

                int leftWidth = cellWidthTwips(logoCell);
                int rightWidth = cellWidthTwips(spacerCell);
                assertEquals(leftWidth, rightWidth,
                        key + ": first and third columns must be equal width for true page-center alignment");

                assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STBorder.NONE,
                        headerTable.getCTTbl().getTblPr().getTblBorders().getTop().getVal(),
                        key + ": header table borders must be none");

                for (XWPFParagraph p : doc.getParagraphs()) {
                    assertBaseFont(key, p);
                }
                for (XWPFTable table : doc.getTables()) {
                    for (XWPFTableRow row : table.getRows()) {
                        for (var cell : row.getTableCells()) {
                            for (XWPFParagraph p : cell.getParagraphs()) {
                                assertBaseFont(key, p);
                            }
                        }
                    }
                }

                String text = extractText(docx);
                assertFalse(text.contains("{{"), key + ": no unresolved placeholder may leak into the document: " + text);
            }
        }
    }

    private static int cellWidthTwips(org.apache.poi.xwpf.usermodel.XWPFTableCell cell) {
        var tcPr = cell.getCTTc().getTcPr();
        assertNotNull(tcPr, "cell must have an explicit width");
        return ((java.math.BigInteger) tcPr.getTcW().getW()).intValue();
    }

    private static void assertBaseFont(ProtocolTemplateKey key, XWPFParagraph paragraph) {
        for (var run : paragraph.getRuns()) {
            assertEquals("Times New Roman", run.getFontFamily(), key + ": font must be Times New Roman");
            assertEquals(12, run.getFontSize(), key + ": font size must be 12pt everywhere");
        }
    }

    private static byte[] createPngBytes(int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.BLUE);
        graphics.fillRect(0, 0, width, height);
        graphics.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static Protocol buildProtocol() {
        Protocol protocol = new Protocol();
        protocol.setProtocolNumber("1");
        protocol.setProtocolDate(LocalDate.of(2026, 7, 14));
        protocol.setCompanyNameSnapshot("ТОО «Тест»");
        protocol.setObjectNameSnapshot("Объект №1");
        protocol.setLaboratoryName("ТОО «АЛАУ Сервис К»");
        protocol.setLaboratoryAddress("г. Шымкент, ул. Темир Казык, 132");
        protocol.setAccreditationNumber("KZ.T.16.E0424");
        protocol.setAccreditationValidFrom(LocalDate.of(2021, 8, 20));
        protocol.setAccreditationValidUntil(LocalDate.of(2030, 8, 20));
        protocol.setTestingMethodNd("МУ 08-47/203");
        return protocol;
    }

    private static ProtocolResult buildResult() {
        ProtocolResult result = new ProtocolResult();
        result.setRowNumber(1);
        result.setIndicatorName("Тестовый показатель");
        result.setUnit("мг/м3");
        result.setNormativeValue(new BigDecimal("1.0"));
        result.setResultValue(new BigDecimal("0.5"));
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
