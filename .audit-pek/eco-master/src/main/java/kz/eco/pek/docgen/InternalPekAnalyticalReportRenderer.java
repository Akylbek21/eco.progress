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
 * Renders the internal CRM analytical PEK report DOCX from an {@link InternalPekAnalyticalDocValues}
 * snapshot. Layout is operationally focused: executive KPI summary (completion %, exceedance count),
 * itemised plan/fact delta table, exceedance analytics, and protocol list. Not bound by the
 * normative Правила №250 template shape - designed for internal management review, not submission.
 */
public final class InternalPekAnalyticalReportRenderer {

    private InternalPekAnalyticalReportRenderer() {}

    public static byte[] render(InternalPekAnalyticalDocValues v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            watermark(doc);
            title(doc, "ВНУТРЕННИЙ АНАЛИТИЧЕСКИЙ ОТЧЁТ ПЭК");
            subtitle(doc, "№ " + v.reportNumber() + "  (версия " + v.version() + ")");

            paragraph(doc, "Организация: " + nz(v.companyName()) + " (БИН " + nz(v.companyBin()) + ")");
            paragraph(doc, "Объект: " + nz(v.objectName()));
            paragraph(doc, "Программа ПЭК: " + nz(v.programName()));
            paragraph(doc, "Период: " + nz(v.periodLabel()) + " (" + nz(v.periodStart()) + " — " + nz(v.periodEnd()) + ")");
            paragraph(doc, "Ответственный: " + nz(v.responsibleUserName()));
            paragraph(doc, "Дата формирования: " + nz(v.generatedAtLabel()));
            paragraph(doc, "Нормативная основа: " + nz(v.regulationVersion()));

            heading(doc, "Сводные показатели");
            XWPFTable kpi = doc.createTable(3, 2);
            setRow(kpi, 0, "Пунктов контроля", v.totalControlItems() + " (выполнено: " + v.completedControlItems() + ")");
            setRow(kpi, 1, "Общее выполнение", v.overallCompletionPercent() + "%");
            setRow(kpi, 2, "Зафиксировано превышений", String.valueOf(v.totalExceedances()));

            heading(doc, "Детализация план / факт");
            if (v.planFactRows().isEmpty()) {
                paragraph(doc, "Данные план/факт отсутствуют.");
            } else {
                XWPFTable t = doc.createTable(v.planFactRows().size() + 1, 5);
                setHeader(t, "Пункт контроля", "План", "Факт", "Выполнение, %", "Превышения");
                int r = 1;
                for (PekReportDocValues.PlanFactRow row : v.planFactRows()) {
                    setRow(t, r++, row.controlItemName(), String.valueOf(row.planned()),
                            String.valueOf(row.actual()), row.completionPercent(), String.valueOf(row.exceedanceCount()));
                }
            }

            heading(doc, "Анализ превышений");
            if (v.exceedances().isEmpty()) {
                paragraph(doc, "Превышений не зафиксировано.");
            } else {
                XWPFTable t = doc.createTable(v.exceedances().size() + 1, 6);
                setHeader(t, "Показатель", "Значение", "Норматив", "Кратность", "Статус", "Мероприятие");
                int r = 1;
                for (PekReportDocValues.ExceedanceRow row : v.exceedances()) {
                    setRow(t, r++, row.indicatorName(), row.actualValue(), row.normativeValue(),
                            row.ratio(), row.status(), nz(row.correctiveAction()));
                }
            }

            heading(doc, "Протоколы лабораторных испытаний");
            if (v.protocols().isEmpty()) {
                paragraph(doc, "Протоколы не прикреплены.");
            } else {
                XWPFTable t = doc.createTable(v.protocols().size() + 1, 3);
                setHeader(t, "Номер", "Дата", "Лаборатория");
                int r = 1;
                for (PekReportDocValues.ProtocolRow row : v.protocols()) {
                    setRow(t, r++, row.number(), row.date(), row.laboratory());
                }
            }

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static void watermark(XWPFDocument doc) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun r = p.createRun();
        r.setFontSize(8);
        r.setItalic(true);
        r.setText("ВНУТРЕННИЙ ДОКУМЕНТ — не является официальным отчётом");
    }

    private static void title(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(14);
        r.setText(text);
    }

    private static void subtitle(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        p.createRun().setText(text);
    }

    private static void heading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(12);
        r.setText(text);
    }

    private static void paragraph(XWPFDocument doc, String text) {
        doc.createParagraph().createRun().setText(text);
    }

    private static void setHeader(XWPFTable t, String... cols) {
        XWPFTableRow row = t.getRow(0);
        for (int i = 0; i < cols.length; i++) {
            XWPFTableCell cell = row.getCell(i);
            if (cell == null) cell = row.addNewTableCell();
            XWPFRun r = cell.getParagraphs().get(0).createRun();
            r.setBold(true);
            r.setText(cols[i]);
        }
    }

    private static void setRow(XWPFTable t, int rowIdx, String... cols) {
        XWPFTableRow row = t.getRow(rowIdx);
        if (row == null) row = t.createRow();
        for (int i = 0; i < cols.length; i++) {
            XWPFTableCell cell = row.getCell(i);
            if (cell == null) cell = row.addNewTableCell();
            cell.getParagraphs().get(0).createRun().setText(nz(cols[i]));
        }
    }

    private static String nz(String v) { return v == null ? "—" : v; }
}
