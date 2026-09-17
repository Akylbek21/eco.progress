package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static kz.eco.pek.docgen.PekDocxWriter.Column;

/** Отчёт о выполнении природоохранных мероприятий за отчётный период. */
public final class PekEnvironmentalMeasuresDocxRenderer {

    private PekEnvironmentalMeasuresDocxRenderer() {
    }

    /** Snapshot the document is rendered from (and stored as the version's snapshotJson). */
    public record Values(String reportNumber, int version, String periodLabel, String companyName,
                         String objectName, String programNumber, String generatedAtLabel,
                         List<Row> rows, String totalPlanned, String totalActual, String totalUtilization,
                         String responsibleName, String directorName) {}

    /** One measure: plan from the program, execution from this period. Amounts already formatted. */
    public record Row(String number, String name, String workVolume, String period, String plannedAmount,
                      String actualAmount, String utilizationPercent, String completionPercent,
                      String environmentalEffect, String status, String note) {}

    private static final List<Column<Row>> COLUMNS = List.of(
            Column.of("№", Row::number),
            Column.of("Наименование мероприятия", Row::name),
            Column.of("Объём работ", Row::workVolume),
            Column.of("Период выполнения", Row::period),
            Column.of("Запланировано", Row::plannedAmount),
            Column.of("Освоено", Row::actualAmount),
            Column.of("Освоение, %", Row::utilizationPercent),
            Column.of("Выполнение, %", Row::completionPercent),
            Column.of("Экологический эффект", Row::environmentalEffect),
            Column.of("Статус", Row::status),
            Column.of("Примечание / причина невыполнения", Row::note));

    public static byte[] render(Values v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PekDocxWriter.title(doc, "ОТЧЁТ");
            PekDocxWriter.subtitle(doc, "о выполнении природоохранных мероприятий за " + v.periodLabel());
            PekDocxWriter.subtitle(doc, v.companyName() + " · " + v.objectName()
                    + (v.programNumber() == null ? "" : " · программа ПЭК № " + v.programNumber()));

            PekDocxWriter.table(doc, COLUMNS, v.rows(),
                    "Программой ПЭК природоохранные мероприятия на отчётный период не предусмотрены.");
            if (!v.rows().isEmpty()) {
                PekDocxWriter.fieldTable(doc, List.of(
                        new String[]{"Итого запланировано", v.totalPlanned()},
                        new String[]{"Итого освоено", v.totalActual()},
                        new String[]{"Освоение средств, %", v.totalUtilization()}));
            }

            PekDocxWriter.paragraph(doc, "");
            PekDocxWriter.signatureLine(doc, "Ответственный за ПЭК", v.responsibleName());
            PekDocxWriter.signatureLine(doc, "Руководитель", v.directorName());
            PekDocxWriter.paragraph(doc, "Сформировано: " + v.generatedAtLabel() + ", версия документа " + v.version());
            doc.write(out);
            return out.toByteArray();
        }
    }
}
