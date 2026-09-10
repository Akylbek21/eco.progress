package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

import java.util.List;
import java.util.function.Function;

/**
 * Shared POI plumbing for the PEK document renderers (official report, internal analytical report,
 * program). Each renderer previously carried its own private copies of these helpers, which drifted
 * - the official renderer's normative header, for one, overwrote its own first line instead of
 * adding a second (setText twice on one run replaces the text rather than appending).
 *
 * <p>Tables are written from a column spec plus a row mapper, so adding or reordering a column of
 * an official table is a change to the spec, not to rendering code.
 */
final class PekDocxWriter {

    private PekDocxWriter() {
    }

    /** One column of a rendered table: its heading, and how to read it off a row object. */
    record Column<T>(String heading, Function<T, String> value) {
        static <T> Column<T> of(String heading, Function<T, String> value) {
            return new Column<>(heading, value);
        }
    }

    static void title(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(14);
        r.setText(text);
    }

    static void subtitle(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun r = p.createRun();
        r.setFontSize(11);
        r.setText(text);
    }

    static void heading(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setBold(true);
        r.setFontSize(12);
        r.setText(text);
    }

    static void paragraph(XWPFDocument doc, String text) {
        doc.createParagraph().createRun().setText(text);
    }

    /** Right-aligned small print naming the regulation edition and template the document follows. */
    static void normativeHeader(XWPFDocument doc, String regulationCitation, String templateVersion) {
        XWPFParagraph p = doc.createParagraph();
        p.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun r = p.createRun();
        r.setFontSize(8);
        r.setItalic(true);
        r.setText("Нормативная основа: " + nz(regulationCitation));
        r.addBreak();
        // A second run, not a second setText on the same run: setText replaces, it does not append.
        XWPFRun r2 = p.createRun();
        r2.setFontSize(8);
        r2.setItalic(true);
        r2.setText("Шаблон: " + nz(templateVersion));
    }

    /** Two-column "label: value" table, for the administrative-data blocks. */
    static void fieldTable(XWPFDocument doc, List<String[]> labelValuePairs) {
        if (labelValuePairs.isEmpty()) {
            return;
        }
        XWPFTable t = doc.createTable(labelValuePairs.size(), 2);
        for (int i = 0; i < labelValuePairs.size(); i++) {
            String[] pair = labelValuePairs.get(i);
            XWPFTableRow row = t.getRow(i);
            boldCell(row, 0, pair[0]);
            plainCell(row, 1, nz(pair[1]));
        }
    }

    /**
     * Renders {@code rows} under {@code columns}, or {@code emptyText} when there are none. An
     * absent section is stated explicitly rather than left blank - a reader cannot tell "nothing to
     * report" from "we forgot" if the table is simply missing.
     */
    static <T> void table(XWPFDocument doc, List<Column<T>> columns, List<T> rows, String emptyText) {
        if (rows.isEmpty()) {
            paragraph(doc, emptyText);
            return;
        }
        XWPFTable t = doc.createTable(rows.size() + 1, columns.size());
        XWPFTableRow header = t.getRow(0);
        for (int c = 0; c < columns.size(); c++) {
            boldCell(header, c, columns.get(c).heading());
        }
        for (int r = 0; r < rows.size(); r++) {
            XWPFTableRow row = t.getRow(r + 1);
            for (int c = 0; c < columns.size(); c++) {
                plainCell(row, c, nz(columns.get(c).value().apply(rows.get(r))));
            }
        }
    }

    static void signatureLine(XWPFDocument doc, String role, String name) {
        paragraph(doc, role + ": ___________________________ / " + nz(name) + " /");
    }

    private static void boldCell(XWPFTableRow row, int index, String text) {
        XWPFRun r = cell(row, index).getParagraphs().get(0).createRun();
        r.setBold(true);
        r.setText(text);
    }

    private static void plainCell(XWPFTableRow row, int index, String text) {
        cell(row, index).getParagraphs().get(0).createRun().setText(text);
    }

    private static XWPFTableCell cell(XWPFTableRow row, int index) {
        XWPFTableCell c = row.getCell(index);
        return c != null ? c : row.addNewTableCell();
    }

    static String nz(String v) {
        return v == null || v.isBlank() ? "—" : v;
    }
}
