package kz.eco.protocol.docgen;

import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolEnvironmentConditions;
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
 * Pure unit test (no Spring context): a field hidden via Protocol.printVisibilityJson must not
 * appear in the rendered DOCX, while its value keeps living on the entity untouched - and
 * setting the same field back to visible must restore it in a fresh render.
 */
class ProtocolPrintVisibilityDocxRenderTest {

    @Test
    void hiddenOrganizationName_isOmittedFromDocxButValueStaysOnEntity() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"organizationName\":false}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        assertFalse(text.contains("ТОО «Polymettech»"), "hidden organization name must not appear in the document: " + text);
        assertEquals("ТОО «Polymettech»", protocol.getCompanyNameSnapshot(), "hiding from print must not touch the stored value");
    }

    @Test
    void visibilityFalseThenTrue_hidesThenRestoresTheSameField() throws Exception {
        Protocol protocol = buildProtocol();

        protocol.setPrintVisibilityJson("{\"productName\":false}");
        String hiddenText = extractText(
                ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null));
        assertFalse(hiddenText.contains("почва"), "product name must be suppressed while hidden: " + hiddenText);

        protocol.setPrintVisibilityJson("{\"productName\":true}");
        String visibleText = extractText(
                ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null));
        assertTrue(visibleText.contains("почва"), "product name must reappear once set back to visible: " + visibleText);
    }

    @Test
    void fieldWithNoStoredSetting_defaultsToVisible() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson(null);

        String text = extractText(
                ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null));

        assertTrue(text.contains("ТОО «Polymettech»"), "a protocol with no visibility settings at all must print every field");
        assertTrue(text.contains("почва"));
    }

    @Test
    void hiddenTestPeriodComponent_dropsOnlyThatSideOfTheRange() throws Exception {
        Protocol protocol = buildProtocol();
        // Distinct from sampleDate/protocolDate so the assertions below can't accidentally
        // match a date that legitimately appears elsewhere in the document (SAMPLING_DATE,
        // MEASUREMENT_DATE, PROTOCOL_DATE all reuse other dates in buildProtocol()).
        protocol.setTestingStartDate(LocalDate.of(2026, 6, 17));
        protocol.setPrintVisibilityJson("{\"testStartDate\":false}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        assertFalse(text.contains("17.06.2026"), "hidden start date must not appear: " + text);
        assertTrue(text.contains("20.06.2026"), "still-visible end date must appear: " + text);
    }

    @Test
    void hiddenTemperature_dropsOnlyThatComponentFromEnvironmentConditions() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"temperature\":false}");
        ProtocolEnvironmentConditions env = new ProtocolEnvironmentConditions();
        env.setTemperatureC(new BigDecimal("21.5"));
        env.setHumidityPercent(new BigDecimal("45"));

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), env);
        String text = extractText(docx);

        assertFalse(text.contains("21,5"), "hidden temperature must not appear: " + text);
        assertTrue(text.contains("влажность"), "still-visible humidity must appear: " + text);
    }

    @Test
    void hiddenProductName_removesTheWholeLabelLineNotJustTheValue() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"productName\":false}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        // "Наименование продукции:" (with the colon) is the field's own label line; the results
        // table header "Наименование продукции (объекта)" shares the same words but never a
        // trailing colon, so this stays a precise match for just the removed paragraph.
        assertFalse(text.contains("Наименование продукции:"),
                "hiding a field must drop its whole label+value line, not leave an empty value next to the label: " + text);
    }

    @Test
    void hidingOnlyOneOfTwoFieldsSharingALine_keepsTheLineAndTheOtherFieldsValue() throws Exception {
        // organizationName and organizationAddress print on the same physical line in the SOIL
        // template ("Наименование и адрес заказчика услуг лаборатории: <name>, <address>") - the
        // whole-paragraph removal must only trigger once EVERY controlled field on that line is
        // hidden, otherwise hiding just one would wipe out the other's still-visible value too.
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"organizationName\":false}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        assertFalse(text.contains("ТОО «Polymettech»"), "hidden organization name must not appear: " + text);
        assertTrue(text.contains("Наименование и адрес заказчика"),
                "the shared line must survive since organizationAddress is still visible: " + text);
        assertTrue(text.contains("Енбекшинский район"), "still-visible organization address must remain: " + text);
    }

    @Test
    void hidingBothFieldsSharingALine_removesTheWholeLine() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"organizationName\":false,\"organizationAddress\":false}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        assertFalse(text.contains("ТОО «Polymettech»"));
        assertFalse(text.contains("Енбекшинский район"));
        assertFalse(text.contains("Наименование и адрес заказчика"),
                "once every field on the shared line is hidden, the whole line must be dropped: " + text);
    }

    @Test
    void hiddenEnvironmentalConditions_blanksTheWholeComposite() throws Exception {
        Protocol protocol = buildProtocol();
        protocol.setPrintVisibilityJson("{\"environmentalConditions\":false}");
        ProtocolEnvironmentConditions env = new ProtocolEnvironmentConditions();
        env.setTemperatureC(new BigDecimal("21.5"));
        env.setHumidityPercent(new BigDecimal("45"));

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), env);
        String text = extractText(docx);

        assertFalse(text.contains("21,5"));
        assertFalse(text.contains("влажность"));
    }

    @Test
    void resultWithDeviceSnapshot_addsEquipmentBlockOnceDeduplicated() throws Exception {
        Protocol protocol = buildProtocol();
        ProtocolResult result1 = buildResult();
        result1.setDeviceId(12L);
        result1.setValuesJson("{\"measurementDeviceName\":\"Газоанализатор ГАНК-4\","
                + "\"measurementDeviceSerialNumber\":\"12547\","
                + "\"measurementDeviceVerificationValidUntil\":\"2027-08-20\"}");
        ProtocolResult result2 = buildResult();
        result2.setRowNumber(2);
        result2.setIndicatorName("Свинец");
        result2.setDeviceId(12L);
        result2.setValuesJson("{\"measurementDeviceName\":\"Газоанализатор ГАНК-4\","
                + "\"measurementDeviceSerialNumber\":\"12547\","
                + "\"measurementDeviceVerificationValidUntil\":\"2027-08-20\"}");

        byte[] docx = ProtocolDocxTemplateRenderer.render(
                ProtocolTemplateKey.SOIL, protocol, List.of(result1, result2), null);
        String text = extractText(docx);

        assertTrue(text.contains("Использованное оборудование"), "equipment block must be present: " + text);
        assertTrue(text.contains("Газоанализатор ГАНК-4"));
        assertTrue(text.contains("зав. №12547"));
        assertTrue(text.contains("20.08.2027"));
        long occurrences = text.split("Газоанализатор ГАНК-4", -1).length - 1;
        assertEquals(1, occurrences, "same device on two rows must be listed once, deduplicated: " + text);
    }

    @Test
    void resultsWithNoDevice_omitEquipmentBlockEntirely() throws Exception {
        Protocol protocol = buildProtocol();

        byte[] docx = ProtocolDocxTemplateRenderer.render(ProtocolTemplateKey.SOIL, protocol, List.of(buildResult()), null);
        String text = extractText(docx);

        assertFalse(text.contains("Использованное оборудование"), "no device attached -> no equipment block: " + text);
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
