package kz.eco.protocol.docgen;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolResult;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ambient_air_szz uses the generic (non-SOIL) results table layout. This renders it with 5+
 * rows and deliberately long indicator names, then inspects the raw OOXML to confirm the table
 * grid/width fix (see ProtocolDocxTemplateRenderer.applyColumnWidths) actually took effect for
 * this template, and that the "НД на методы испытаний" column carries real text instead of "—".
 */
class AmbientAirProtocolDocxTableTest {

    private static final String[] LONG_INDICATORS = {
            "Азота диоксид (Азота (IV) оксид), очень длинное наименование показателя для проверки переноса текста по словам",
            "Углерод оксид (Углерода оксид), также длинное наименование определяемого показателя",
            "Серы диоксид (Ангидрид сернистый), показатель с длинным химическим наименованием",
            "Взвешенные вещества (пыль/аэрозоль), суммарная характеристика загрязнения воздуха",
            "Формальдегид, показатель с ПДК на уровне следовых концентраций в атмосферном воздухе",
            "Гидроксибензол (Фенол), ещё один показатель с длинным систематическим наименованием"
    };

    @Test
    void ambientAirSzz_resultsTable_withManyLongRows_rendersFullWidthGridAndTestingMethod() throws Exception {
        Protocol protocol = buildProtocol();
        List<ProtocolResult> results = buildResults();

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.fromTemplateId("ambient_air_szz"),
                protocol, results, null);

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            XWPFTable table = doc.getTables().stream()
                    .filter(t -> t.getText().contains("Формальдегид"))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("results table not found"));

            assertEquals(LONG_INDICATORS.length + 1, table.getNumberOfRows(),
                    "header row + one row per result");

            var tblPr = table.getCTTbl().getTblPr();
            assertNotNull(tblPr.getTblW());
            int tableWidth = ((java.math.BigInteger) tblPr.getTblW().getW()).intValue();
            assertTrue(tableWidth >= 9000, "table must span the full printable width: " + tableWidth);
            assertEquals(org.openxmlformats.schemas.wordprocessingml.x2006.main.STTblLayoutType.FIXED,
                    tblPr.getTblLayout().getType(), "layout must be fixed, not autofit-to-content");

            var grid = table.getCTTbl().getTblGrid();
            assertNotNull(grid, "tblGrid must be present");
            assertEquals(5, grid.sizeOfGridColArray());
            int gridTotal = 0;
            for (var col : grid.getGridColArray()) {
                gridTotal += ((java.math.BigInteger) col.getW()).intValue();
            }
            assertEquals(tableWidth, gridTotal);
            for (var col : grid.getGridColArray()) {
                int colWidth = ((java.math.BigInteger) col.getW()).intValue();
                assertTrue(colWidth >= 1000, "no column should be squeezed to a near-zero width: " + colWidth);
            }

            // Every data row must carry the protocol-level testing method fallback text (rows
            // themselves have no testingMethodNd set), proving the "—" bug is fixed.
            for (int r = 1; r < table.getNumberOfRows(); r++) {
                String rowText = table.getRow(r).getCell(2).getText();
                assertEquals("ГОСТ Р 58578-2019 Воздух атмосферный. Общие требования к методам измерений", rowText,
                        "row " + r + " must show the protocol-level testing method, not \"—\"");
                assertNotEquals("—", rowText);
            }

            String fullText = table.getText();
            for (String indicator : LONG_INDICATORS) {
                assertTrue(fullText.contains(indicator.substring(0, 20)),
                        "long indicator name must be present in full (not truncated): " + indicator);
            }
        }
    }

    private static Protocol buildProtocol() {
        Protocol protocol = new Protocol();
        protocol.setTemplateCode("AMBIENT_AIR_SZZ");
        protocol.setProtocolNumber("77");
        protocol.setProtocolDate(LocalDate.of(2026, 7, 1));
        protocol.setCompanyNameSnapshot("ТОО «ЭкоЗавод»");
        protocol.setObjectNameSnapshot("СЗЗ точка №3");
        protocol.setLaboratoryName("ТОО «АЛАУ Сервис К»");
        protocol.setTestingMethodNd("ГОСТ Р 58578-2019 Воздух атмосферный. Общие требования к методам измерений");
        return protocol;
    }

    private static List<ProtocolResult> buildResults() {
        List<ProtocolResult> results = new ArrayList<>();
        int i = 1;
        for (String indicator : LONG_INDICATORS) {
            ProtocolResult result = new ProtocolResult();
            result.setRowNumber(i);
            result.setMeasurementPlace("Точка №" + i);
            result.setIndicatorName(indicator);
            result.setUnit("мг/м3");
            result.setNormativeValue(new BigDecimal("0.2"));
            result.setResultValue(new BigDecimal("0.1" + i));
            result.setComparisonType(ComparisonType.LESS_OR_EQUAL);
            // Deliberately no testingMethodNd on the row - must fall back to protocol-level.
            results.add(result);
            i++;
        }
        return results;
    }
}
