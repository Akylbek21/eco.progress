package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Renders a {@link PekReportDocValues} snapshot into a DOCX byte array using Apache POI XWPF -
 * same library ProtocolDocxTemplateRenderer uses for protocol documents (kz.eco.protocol.docgen),
 * so this mirrors that choice rather than introducing a second templating engine. Unlike the
 * protocol renderer (which fills a pre-built .dotx template), PEK has no existing template asset to
 * reuse, so this builds the document structurally straight from POI's API - the output shape
 * (headings, a company/object/period info block, a plan/fact table, an exceedances table, a
 * protocol-list table, a signing block) is what module spec's final-report layout calls for.
 */
public final class PekReportDocxRenderer {

    private PekReportDocxRenderer() {
    }

    public static byte[] render(PekReportDocValues v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            title(doc, "Отчёт по производственному экологическому контролю");
            subtitle(doc, "№ " + v.reportNumber() + " (версия " + v.version() + ")");

            paragraph(doc, "Организация: " + nz(v.companyName()) + " (БИН " + nz(v.companyBin()) + ")");
            paragraph(doc, "Объект: " + nz(v.objectName()));
            paragraph(doc, "Программа ПЭК: " + nz(v.programName()));
            paragraph(doc, "Период отчёта: " + nz(v.periodLabel()) + " (" + nz(v.periodStart()) + " - " + nz(v.periodEnd()) + ")");
            paragraph(doc, "Ответственный: " + nz(v.responsibleUserName()));
            paragraph(doc, "Дата формирования: " + nz(v.generatedAtLabel()));

            heading(doc, "Действующие разрешительные документы");
            if (v.permits().isEmpty()) {
                paragraph(doc, "Нет действующих разрешений на выбранный период.");
            } else {
                XWPFTable t = doc.createTable(v.permits().size() + 1, 4);
                setHeader(t, "Тип", "Номер", "Действует до", "Статус");
                int r = 1;
                for (PekReportDocValues.PermitRow p : v.permits()) {
                    setRow(t, r++, p.type(), p.number(), p.validUntil(), p.status());
                }
            }

            heading(doc, "План / факт выполнения программы");
            if (v.planFactRows().isEmpty()) {
                paragraph(doc, "Нет данных план/факт.");
            } else {
                XWPFTable t = doc.createTable(v.planFactRows().size() + 1, 5);
                setHeader(t, "Пункт контроля", "План", "Факт", "Выполнение, %", "Превышения");
                int r = 1;
                for (PekReportDocValues.PlanFactRow row : v.planFactRows()) {
                    setRow(t, r++, row.controlItemName(), String.valueOf(row.planned()),
                            String.valueOf(row.actual()), row.completionPercent(), String.valueOf(row.exceedanceCount()));
                }
            }

            heading(doc, "Превышения нормативов и корректирующие мероприятия");
            if (v.exceedances().isEmpty()) {
                paragraph(doc, "Превышений за период не зафиксировано.");
            } else {
                XWPFTable t = doc.createTable(v.exceedances().size() + 1, 6);
                setHeader(t, "Показатель", "Значение", "Норматив", "Кратность", "Статус", "Корректирующее мероприятие");
                int r = 1;
                for (PekReportDocValues.ExceedanceRow row : v.exceedances()) {
                    setRow(t, r++, row.indicatorName(), row.actualValue(), row.normativeValue(),
                            row.ratio(), row.status(), nz(row.correctiveAction()));
                }
            }

            heading(doc, "Протоколы лабораторных испытаний");
            if (v.protocols().isEmpty()) {
                paragraph(doc, "Нет связанных протоколов.");
            } else {
                XWPFTable t = doc.createTable(v.protocols().size() + 1, 3);
                setHeader(t, "Номер протокола", "Дата", "Лаборатория");
                int r = 1;
                for (PekReportDocValues.ProtocolRow row : v.protocols()) {
                    setRow(t, r++, row.number(), row.date(), row.laboratory());
                }
            }

            heading(doc, "Подпись");
            paragraph(doc, "Ответственный: " + nz(v.responsibleUserName()));
            paragraph(doc, "Подпись: ______________________");
            paragraph(doc, "Дата: ______________________");

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static String nz(String s) { return s == null || s.isBlank() ? "-" : s; }

    private static void title(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(16);
        r.setText(text);
    }

    private static void subtitle(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setFontSize(12);
        r.setText(text);
    }

    private static void heading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(13);
        r.setText(text);
    }

    private static void paragraph(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setFontSize(11);
        r.setText(text);
    }

    private static void setHeader(XWPFTable t, String... headers) {
        XWPFTableRow row = t.getRow(0);
        for (int i = 0; i < headers.length; i++) {
            XWPFTableCell cell = row.getCell(i);
            cell.removeParagraph(0);
            XWPFParagraph p = cell.addParagraph();
            XWPFRun r = p.createRun();
            r.setBold(true);
            r.setText(headers[i]);
        }
    }

    private static void setRow(XWPFTable t, int rowIndex, String... values) {
        XWPFTableRow row = t.getRow(rowIndex);
        for (int i = 0; i < values.length; i++) {
            XWPFTableCell cell = row.getCell(i);
            cell.setText(nz(values[i]));
        }
    }
}
