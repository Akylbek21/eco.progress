package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static kz.eco.pek.docgen.PekDocxWriter.Column;

/** Пояснительная записка к отчёту ПЭК за период. Sections follow the order the sample package uses. */
public final class PekExplanatoryNoteDocxRenderer {

    private PekExplanatoryNoteDocxRenderer() {
    }

    private static final List<Column<PekExplanatoryNoteDocValues.MonitoringRow>> MONITORING_COLUMNS = List.of(
            Column.of("Компонент", PekExplanatoryNoteDocValues.MonitoringRow::component),
            Column.of("Направление", PekExplanatoryNoteDocValues.MonitoringRow::name),
            Column.of("Методика", PekExplanatoryNoteDocValues.MonitoringRow::methodology),
            Column.of("Точки контроля", PekExplanatoryNoteDocValues.MonitoringRow::points));

    private static final List<Column<PekExplanatoryNoteDocValues.ProtocolRow>> PROTOCOL_COLUMNS = List.of(
            Column.of("№ протокола", PekExplanatoryNoteDocValues.ProtocolRow::number),
            Column.of("Дата", PekExplanatoryNoteDocValues.ProtocolRow::date),
            Column.of("Лаборатория", PekExplanatoryNoteDocValues.ProtocolRow::laboratory));

    private static final List<Column<PekExplanatoryNoteDocValues.ExceedanceRow>> EXCEEDANCE_COLUMNS = List.of(
            Column.of("Показатель", PekExplanatoryNoteDocValues.ExceedanceRow::indicator),
            Column.of("Факт", PekExplanatoryNoteDocValues.ExceedanceRow::actual),
            Column.of("Норматив", PekExplanatoryNoteDocValues.ExceedanceRow::normative),
            Column.of("Кратность", PekExplanatoryNoteDocValues.ExceedanceRow::ratio),
            Column.of("Статус", PekExplanatoryNoteDocValues.ExceedanceRow::status),
            Column.of("Корректирующее действие", PekExplanatoryNoteDocValues.ExceedanceRow::correctiveAction));

    public static byte[] render(PekExplanatoryNoteDocValues v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PekDocxWriter.title(doc, "ПОЯСНИТЕЛЬНАЯ ЗАПИСКА");
            PekDocxWriter.subtitle(doc, "к отчёту по производственному экологическому контролю за " + v.periodLabel());
            PekDocxWriter.subtitle(doc, v.companyName() + " · " + v.objectName());

            PekDocxWriter.heading(doc, "1. Сведения о предприятии и объекте");
            PekDocxWriter.fieldTable(doc, List.of(
                    new String[]{"Наименование предприятия", v.companyName()},
                    new String[]{"БИН", v.companyBin()},
                    new String[]{"Юридический адрес", v.legalAddress()},
                    new String[]{"Объект", v.objectName()},
                    new String[]{"Адрес объекта", v.objectAddress()},
                    new String[]{"КАТО", v.kato()},
                    new String[]{"ОКЭД", v.oked()},
                    new String[]{"Категория объекта", v.environmentalCategory()},
                    new String[]{"Программа ПЭК", joinProgram(v)},
                    new String[]{"Отчётный период", v.periodStart() + " — " + v.periodEnd()}));
            if (hasText(v.facilityInformation())) {
                PekDocxWriter.paragraph(doc, v.facilityInformation());
            }

            PekDocxWriter.heading(doc, "2. Характеристика производства и технологического процесса");
            PekDocxWriter.paragraph(doc, v.productionCharacteristics());
            PekDocxWriter.heading(doc, "2.1. Технологический процесс");
            PekDocxWriter.paragraph(doc, v.technologicalProcess());
            PekDocxWriter.fieldTable(doc, List.of(
                    new String[]{"Проектная мощность", v.designCapacity()},
                    new String[]{"Фактическая мощность за период", v.actualCapacity()}));

            PekDocxWriter.heading(doc, "3. Основные источники воздействия на окружающую среду");
            PekDocxWriter.paragraph(doc, v.mainImpactSources());
            PekDocxWriter.fieldTable(doc, List.of(
                    new String[]{"Источников выбросов в атмосферу", String.valueOf(v.emissionSourceCount())},
                    new String[]{"Выпусков сточных вод", String.valueOf(v.dischargeSourceCount())},
                    new String[]{"Видов отходов", String.valueOf(v.wasteItemCount())}));

            PekDocxWriter.heading(doc, "4. Выполненные исследования");
            PekDocxWriter.paragraph(doc, v.performedStudies());
            PekDocxWriter.table(doc, MONITORING_COLUMNS, v.monitoring(), "Направления мониторинга не включены.");
            PekDocxWriter.paragraph(doc, "Протоколы испытаний, использованные в отчёте:");
            PekDocxWriter.table(doc, PROTOCOL_COLUMNS, v.protocols(), "Протоколы за период не привязаны.");

            PekDocxWriter.heading(doc, "5. Результаты производственного мониторинга");
            PekDocxWriter.paragraph(doc, "Выполнено измерений: " + v.completedMeasurements()
                    + " из " + v.plannedMeasurements() + " запланированных.");
            PekDocxWriter.paragraph(doc, v.monitoringResultsSummary());

            PekDocxWriter.heading(doc, "6. Выявленные превышения и принятые меры");
            PekDocxWriter.table(doc, EXCEEDANCE_COLUMNS, v.exceedances(),
                    "Превышений нормативов за отчётный период не выявлено.");
            if (hasText(v.exceedancesSummary())) {
                PekDocxWriter.paragraph(doc, v.exceedancesSummary());
            }
            if (hasText(v.measuresTaken())) {
                PekDocxWriter.heading(doc, "6.1. Принятые меры");
                PekDocxWriter.paragraph(doc, v.measuresTaken());
            }

            PekDocxWriter.heading(doc, "7. Вывод");
            PekDocxWriter.paragraph(doc, v.conclusion());

            PekDocxWriter.paragraph(doc, "");
            PekDocxWriter.signatureLine(doc, "Ответственный за ПЭК", v.responsibleName());
            PekDocxWriter.signatureLine(doc, "Руководитель", v.directorName());
            PekDocxWriter.paragraph(doc, "Сформировано: " + v.generatedAtLabel() + ", версия документа " + v.version());

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static String joinProgram(PekExplanatoryNoteDocValues v) {
        if (!hasText(v.programNumber())) return v.programName();
        return "№ " + v.programNumber() + (hasText(v.programName()) ? " «" + v.programName() + "»" : "");
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
