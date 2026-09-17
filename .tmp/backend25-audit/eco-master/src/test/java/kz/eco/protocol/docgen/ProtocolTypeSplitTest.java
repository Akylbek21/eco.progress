package kz.eco.protocol.docgen;

import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolTemplateCode;
import kz.eco.protocol.ProtocolTypeRegistry;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** СЗЗ and industrial-emission protocols are separate types with separate Word forms. */
class ProtocolTypeSplitTest {

    @Test
    void industrialEmissions_isNoLongerAnAliasOfAmbientAir() {
        assertEquals("industrial_emissions", ProtocolTypeRegistry.require("industrial_emissions").templateId());
        assertEquals("ambient_air_szz", ProtocolTypeRegistry.require("ambient_air_szz").templateId());
        assertNotEquals(ProtocolTypeRegistry.require("industrial_emissions").docxTemplateCode(),
                ProtocolTypeRegistry.require("ambient_air_szz").docxTemplateCode());
        assertEquals(ProtocolTemplateKey.INDUSTRIAL_EMISSIONS, ProtocolTemplateKey.fromTemplateId("industrial_emissions"));
        assertEquals(ProtocolTemplateKey.INDUSTRIAL_EMISSIONS, ProtocolTemplateKey.fromTemplateId("INDUSTRIAL_EMISSIONS"));
    }

    @Test
    void legacyAmbientAirAliases_resolveToTheCanonicalSzzType() {
        for (String alias : List.of("ambient_air", "atmospheric_air", "AMBIENT_AIR_SZZ", "ambient-air")) {
            assertEquals("ambient_air_szz", ProtocolTypeRegistry.require(alias).templateId(), alias);
            assertEquals(ProtocolTemplateKey.AMBIENT_AIR_SZZ, ProtocolTemplateKey.fromTemplateId(alias), alias);
        }
        assertEquals("ambient_air_szz", ProtocolTemplateCode.AMBIENT_AIR_SZZ.toApiId());
        assertEquals("industrial_emissions", ProtocolTemplateCode.INDUSTRIAL_EMISSIONS.toApiId());
        // An old client still sending the old Word template code for the СЗЗ type is consistent.
        ProtocolTypeRegistry.validateConsistency(ProtocolTypeRegistry.require("ambient_air"), "DSM_70", "protocol_ambient_air");
    }

    @Test
    void bothTypesHaveATemplateOnTheClasspath() {
        assertTrue(ProtocolTypeRegistry.require("ambient_air_szz").active());
        assertTrue(ProtocolTypeRegistry.require("industrial_emissions").active());
    }

    @Test
    void szzForm_printsPointsPdkAndShareOfPdk() throws Exception {
        ProtocolResult r = new ProtocolResult();
        r.setRowNumber(1);
        r.setIndicatorName("Азота диоксид");
        r.setUnit("мг/м³");
        r.setMeasurementPlace("ТК-1");
        r.setDirection("север");
        r.setResultValue(new BigDecimal("0.10"));
        r.setPdkMgM3(new BigDecimal("0.20"));

        XWPFTable table = resultsTable(ProtocolTemplateKey.AMBIENT_AIR_SZZ, r, "Азота диоксид");
        assertEquals("Точка контроля / сторона света", table.getRow(0).getCell(0).getText());
        assertEquals("Доля ПДК", table.getRow(0).getCell(5).getText());
        assertEquals("ТК-1 (север)", table.getRow(1).getCell(0).getText());
        assertEquals("0,5", table.getRow(1).getCell(5).getText());
    }

    @Test
    void emissionsForm_printsSourceGasFlowMassEmissionAndDeviation() throws Exception {
        ProtocolResult r = new ProtocolResult();
        r.setRowNumber(1);
        r.setIndicatorName("Углерод оксид");
        r.setPollutionSourceNumber("0001");
        r.setTemperatureC(new BigDecimal("120"));
        r.setFlowSpeedMs(new BigDecimal("8.5"));
        r.setResultMgM3(new BigDecimal("150"));
        r.setResultGs(new BigDecimal("0.012"));
        r.setPdvGs(new BigDecimal("0.010"));

        XWPFTable table = resultsTable(ProtocolTemplateKey.INDUSTRIAL_EMISSIONS, r, "Углерод оксид");
        assertEquals(9, table.getRow(0).getTableCells().size());
        assertEquals("Параметры газового потока", table.getRow(0).getCell(1).getText());
        assertEquals("0001", table.getRow(1).getCell(0).getText());
        assertEquals("t = 120 °C; V = 8,5 м/с", table.getRow(1).getCell(1).getText());
        assertEquals("0,012", table.getRow(1).getCell(4).getText());
        assertEquals("0,01", table.getRow(1).getCell(6).getText());
        assertEquals("+20", table.getRow(1).getCell(7).getText());
    }

    private static XWPFTable resultsTable(ProtocolTemplateKey key, ProtocolResult r, String marker) throws Exception {
        Protocol p = new Protocol();
        p.setProtocolNumber("T-1");
        p.setTestingMethodNd("МВИ 01");
        byte[] docx = ProtocolDocxTemplateRenderer.render(key, p, List.of(r), null);
        XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx));
        return doc.getTables().stream().filter(t -> t.getText().contains(marker)).findFirst().orElseThrow();
    }
}
