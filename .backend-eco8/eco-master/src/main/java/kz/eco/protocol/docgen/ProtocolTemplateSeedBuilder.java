package kz.eco.protocol.docgen;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;

/**
 * Builds the real laboratory DOCX templates (letterhead, field labels, results-table marker,
 * signature block) that {@link ProtocolDocxTemplateRenderer} later fills in. Structure and
 * wording are modeled directly on the laboratory's real Word protocols (see src/main/resources/docs),
 * not a generic demo layout.
 *
 * This is a one-off seed generator, not called at runtime — see GenerateProtocolTemplates.
 */
public final class ProtocolTemplateSeedBuilder {

    private static final String FONT = "Times New Roman";
    private static final int BODY_SIZE = 11;
    private static final int TITLE_SIZE = 14;
    private static final int FOOTER_SIZE = 9;

    private ProtocolTemplateSeedBuilder() {
    }

    public static byte[] build(ProtocolTemplateKey key) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            setupPageMargins(doc);
            addLetterhead(doc);
            addTitle(doc);
            addFieldLabels(doc, key);
            addResultsTableMarker(doc);
            addSignatureBlock(doc);
            addFooter(doc);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static void setupPageMargins(XWPFDocument doc) {
        CTSectPr sectPr = doc.getDocument().getBody().isSetSectPr()
                ? doc.getDocument().getBody().getSectPr()
                : doc.getDocument().getBody().addNewSectPr();
        CTPageMar pageMar = sectPr.isSetPgMar() ? sectPr.getPgMar() : sectPr.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(850));
        pageMar.setBottom(BigInteger.valueOf(850));
        pageMar.setLeft(BigInteger.valueOf(1134));
        pageMar.setRight(BigInteger.valueOf(850));
    }

    private static void addLetterhead(XWPFDocument doc) {
        XWPFParagraph name = doc.createParagraph();
        name.setAlignment(ParagraphAlignment.CENTER);
        run(name, "{{LAB_NAME}}", true, BODY_SIZE);

        XWPFParagraph subtitle = doc.createParagraph();
        subtitle.setAlignment(ParagraphAlignment.CENTER);
        run(subtitle, "Испытательная лаборатория", false, BODY_SIZE);

        XWPFParagraph accreditation = doc.createParagraph();
        accreditation.setAlignment(ParagraphAlignment.CENTER);
        run(accreditation, "Аттестат аккредитации № {{ACCREDITATION_NUMBER}}", false, BODY_SIZE);

        XWPFParagraph validity = doc.createParagraph();
        validity.setAlignment(ParagraphAlignment.CENTER);
        run(validity, "от {{ACCREDITATION_VALID_FROM}}, действителен до {{ACCREDITATION_VALID_UNTIL}}", false, BODY_SIZE);

        XWPFParagraph address = doc.createParagraph();
        address.setAlignment(ParagraphAlignment.CENTER);
        run(address, "{{LAB_ADDRESS}}", false, BODY_SIZE);

        emptyParagraph(doc);
    }

    private static void addTitle(XWPFDocument doc) {
        XWPFParagraph titlePara = doc.createParagraph();
        titlePara.setAlignment(ParagraphAlignment.CENTER);
        titlePara.setSpacingBefore(120);
        run(titlePara, "ПРОТОКОЛ ИСПЫТАНИЙ №{{PROTOCOL_NUMBER}}", true, TITLE_SIZE);

        XWPFParagraph datePara = doc.createParagraph();
        datePara.setAlignment(ParagraphAlignment.CENTER);
        run(datePara, "от {{PROTOCOL_DATE}} года.", false, BODY_SIZE);

        XWPFParagraph pagesPara = doc.createParagraph();
        pagesPara.setAlignment(ParagraphAlignment.RIGHT);
        run(pagesPara, "Всего листов {{TOTAL_PAGES}}", false, BODY_SIZE);

        emptyParagraph(doc);
    }

    private static void addFieldLabels(XWPFDocument doc, ProtocolTemplateKey key) {
        boolean soil = key == ProtocolTemplateKey.SOIL;
        String samplingPlaceLabel = soil ? "Место отбора продукции:" : "Место отбора:";
        String samplingMethodLabel = soil ? "НД на методы отбора продукции:" : "НД на методы отбора:";
        String samplingDateLabel = soil ? "Дата отбора продукции (образцов):" : "Дата отбора:";
        String conditionsLabel = isPhysicalFactor(key) ? "Условия окружающей среды:" : "Условия проведения испытаний:";

        addLabelValue(doc, "Наименование и адрес заказчика услуг лаборатории:",
                "{{CUSTOMER_NAME}}, {{CUSTOMER_ADDRESS}}");
        addLabelValue(doc, "БИН/ИИН заказчика:", "{{CUSTOMER_BIN}}");
        addLabelValue(doc, "Наименование объекта:", "{{OBJECT_NAME}}, {{OBJECT_ADDRESS}}");
        addLabelValue(doc, "Наименование продукции:", "{{PRODUCT_NAME}}");
        addLabelValue(doc, "Основание для испытаний:", "{{TEST_BASIS}}");
        addLabelValue(doc, samplingPlaceLabel, "{{MEASUREMENT_PLACE}}");
        addLabelValue(doc, samplingMethodLabel, "{{SAMPLING_METHOD_ND}}");
        addLabelValue(doc, "НД на методы испытаний:", "{{TESTING_METHOD_ND}}");
        addLabelValue(doc, samplingDateLabel, "{{SAMPLING_DATE}}");
        addLabelValue(doc, "Дата измерения:", "{{MEASUREMENT_DATE}}");
        addLabelValue(doc, "Дата проведения испытаний:", "{{TEST_PERIOD}}");
        addLabelValue(doc, "Цель испытаний:", "{{TEST_PURPOSE}}");
        addLabelValue(doc, conditionsLabel, "{{ENVIRONMENT_CONDITIONS}}");

        emptyParagraph(doc);
    }

    private static boolean isPhysicalFactor(ProtocolTemplateKey key) {
        return key == ProtocolTemplateKey.MICROCLIMATE || key == ProtocolTemplateKey.LIGHTING
                || key == ProtocolTemplateKey.NOISE_VIBRATION || key == ProtocolTemplateKey.UV_EMF_LASER;
    }

    private static void addLabelValue(XWPFDocument doc, String label, String value) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(40);
        p.setSpacingBefore(40);
        run(p, label, true, BODY_SIZE);
        run(p, " " + value, false, BODY_SIZE);
    }

    private static void addResultsTableMarker(XWPFDocument doc) {
        XWPFParagraph marker = doc.createParagraph();
        run(marker, ProtocolDocxTemplateRenderer.RESULTS_TABLE_MARKER, false, BODY_SIZE);
        emptyParagraph(doc);
    }

    private static void addSignatureBlock(XWPFDocument doc) {
        emptyParagraph(doc);
        addSignatureLine(doc, "Исполнитель:", "{{EXECUTOR_NAME}}");
        emptyParagraph(doc);
        addSignatureLine(doc, "Заведующий ИЛ:", "{{HEAD_NAME}}");
    }

    private static void addSignatureLine(XWPFDocument doc, String role, String name) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(0);
        run(p, role, true, BODY_SIZE);
        XWPFRun tabRun = p.createRun();
        tabRun.setFontFamily(FONT);
        tabRun.setFontSize(BODY_SIZE);
        tabRun.addTab();
        tabRun.setText("_____________________");
        tabRun.addTab();
        run(p, name, false, BODY_SIZE);

        XWPFParagraph signLabel = doc.createParagraph();
        signLabel.setAlignment(ParagraphAlignment.CENTER);
        run(signLabel, "(подпись)", false, FOOTER_SIZE);
    }

    private static void addFooter(XWPFDocument doc) {
        emptyParagraph(doc);
        XWPFParagraph p1 = doc.createParagraph();
        p1.setAlignment(ParagraphAlignment.CENTER);
        run(p1, "Протокол распространяется только на образцы, подвергнутые испытаниям.", false, FOOTER_SIZE);

        XWPFParagraph p2 = doc.createParagraph();
        p2.setAlignment(ParagraphAlignment.CENTER);
        run(p2, "Перепечатка протокола без разрешения ИЛ запрещается.", false, FOOTER_SIZE);
    }

    private static void emptyParagraph(XWPFDocument doc) {
        XWPFParagraph p = doc.createParagraph();
        p.setSpacingAfter(0);
        p.setSpacingBefore(0);
    }

    private static void run(XWPFParagraph paragraph, String text, boolean bold, int size) {
        XWPFRun r = paragraph.createRun();
        r.setFontFamily(FONT);
        r.setFontSize(size);
        r.setBold(bold);
        r.setText(text);
    }
}
