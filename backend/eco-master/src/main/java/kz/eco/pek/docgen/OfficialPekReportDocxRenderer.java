package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static kz.eco.pek.docgen.PekDocxWriter.Column;

/**
 * Renders the official (state-facing) PEK report.
 *
 * <p>What changed: this used to emit five sections - permits, plan/fact, exceedances, protocols,
 * signatures - which is the internal analytical report's shape. Nothing in it was organised the way
 * an official submission is: there was no administrative-data block at all (no КАТО, no ОКЭД, no
 * category, no capacities), and no per-component environmental tables, because until the subject
 * models existed there was nothing to fill them from.
 *
 * <p>The document is now organised as administrative data, then permits, then the monitoring
 * actually carried out, then one table per applicable environmental component, then the results
 * (plan/fact, exceedances, protocols), then signatures. Component sections render only when the
 * program declares that component - a facility with no discharge outlets does not get an empty
 * wastewater table, it gets no wastewater section.
 *
 * <p>Column sets live in {@link #EMISSION_COLUMNS} and friends rather than inline in the drawing
 * code, so adjusting a table to a revised form is an edit to a spec.
 */
public final class OfficialPekReportDocxRenderer {

    private OfficialPekReportDocxRenderer() {
    }

    private static final List<Column<PekReportDocValues.PermitRow>> PERMIT_COLUMNS = List.of(
            Column.of("Вид документа", PekReportDocValues.PermitRow::type),
            Column.of("Номер", PekReportDocValues.PermitRow::number),
            Column.of("Действует до", PekReportDocValues.PermitRow::validUntil),
            Column.of("Статус", PekReportDocValues.PermitRow::status));

    private static final List<Column<OfficialPekReportDocValues.MonitoringRow>> MONITORING_COLUMNS = List.of(
            Column.of("Компонент", OfficialPekReportDocValues.MonitoringRow::monitoringType),
            Column.of("Наименование", OfficialPekReportDocValues.MonitoringRow::name),
            Column.of("Метод контроля", OfficialPekReportDocValues.MonitoringRow::methodology),
            Column.of("Периодичность", OfficialPekReportDocValues.MonitoringRow::frequency),
            Column.of("Кол-во точек", r -> String.valueOf(r.pointCount())),
            Column.of("Точки отбора/измерений", OfficialPekReportDocValues.MonitoringRow::pointNames));

    private static final List<Column<OfficialPekReportDocValues.EmissionSourceRow>> EMISSION_COLUMNS = List.of(
            Column.of("№ источника", OfficialPekReportDocValues.EmissionSourceRow::code),
            Column.of("Наименование", OfficialPekReportDocValues.EmissionSourceRow::name),
            Column.of("Тип", OfficialPekReportDocValues.EmissionSourceRow::sourceType),
            Column.of("Цех/участок", OfficialPekReportDocValues.EmissionSourceRow::workshopName),
            Column.of("Высота, м", OfficialPekReportDocValues.EmissionSourceRow::heightM),
            Column.of("Диаметр, м", OfficialPekReportDocValues.EmissionSourceRow::diameterM),
            Column.of("Координаты", OfficialPekReportDocValues.EmissionSourceRow::coordinates),
            Column.of("Газоочистка", OfficialPekReportDocValues.EmissionSourceRow::gasCleaningEquipment),
            Column.of("Степень очистки, %", OfficialPekReportDocValues.EmissionSourceRow::cleaningEfficiencyPercent),
            Column.of("Часов в год", OfficialPekReportDocValues.EmissionSourceRow::operatingHoursPerYear));

    private static final List<Column<OfficialPekReportDocValues.DischargeSourceRow>> DISCHARGE_COLUMNS = List.of(
            Column.of("№ выпуска", OfficialPekReportDocValues.DischargeSourceRow::code),
            Column.of("Наименование", OfficialPekReportDocValues.DischargeSourceRow::name),
            Column.of("Водоприёмник", OfficialPekReportDocValues.DischargeSourceRow::receivingWaterBody),
            Column.of("Вид сброса", OfficialPekReportDocValues.DischargeSourceRow::dischargeType),
            Column.of("Координаты", OfficialPekReportDocValues.DischargeSourceRow::coordinates),
            Column.of("Разрешённый объём", r -> join(r.permittedVolume(), r.volumeUnit())),
            Column.of("Очистные сооружения", OfficialPekReportDocValues.DischargeSourceRow::treatmentFacilities));

    private static final List<Column<OfficialPekReportDocValues.WasteRow>> WASTE_COLUMNS = List.of(
            Column.of("Вид отхода", OfficialPekReportDocValues.WasteRow::name),
            Column.of("Код", OfficialPekReportDocValues.WasteRow::code),
            Column.of("Класс опасности", OfficialPekReportDocValues.WasteRow::hazardClass),
            Column.of("Лимит накопления", r -> join(r.accumulationLimit(), r.limitUnit())),
            Column.of("Срок накопления, сут.", OfficialPekReportDocValues.WasteRow::accumulationPeriodDays),
            Column.of("Место накопления", OfficialPekReportDocValues.WasteRow::storageSiteName),
            Column.of("Координаты", OfficialPekReportDocValues.WasteRow::coordinates),
            Column.of("Остаток на начало", OfficialPekReportDocValues.WasteRow::openingBalance),
            Column.of("Образование", OfficialPekReportDocValues.WasteRow::generated),
            Column.of("Передача", OfficialPekReportDocValues.WasteRow::transferred),
            Column.of("Удаление", OfficialPekReportDocValues.WasteRow::disposed),
            Column.of("Остаток на конец", OfficialPekReportDocValues.WasteRow::closingBalance),
            Column.of("Получатель", OfficialPekReportDocValues.WasteRow::receiverName),
            Column.of("БИН получателя", OfficialPekReportDocValues.WasteRow::receiverBin));

    private static final List<Column<PekReportDocValues.PlanFactRow>> PLAN_FACT_COLUMNS = List.of(
            Column.of("Пункт контроля", PekReportDocValues.PlanFactRow::controlItemName),
            Column.of("План", r -> String.valueOf(r.planned())),
            Column.of("Факт", r -> String.valueOf(r.actual())),
            Column.of("Выполнение, %", PekReportDocValues.PlanFactRow::completionPercent),
            Column.of("Превышения", r -> String.valueOf(r.exceedanceCount())));

    private static final List<Column<PekReportDocValues.ExceedanceRow>> EXCEEDANCE_COLUMNS = List.of(
            Column.of("Показатель", PekReportDocValues.ExceedanceRow::indicatorName),
            Column.of("Фактическое значение", PekReportDocValues.ExceedanceRow::actualValue),
            Column.of("Норматив", PekReportDocValues.ExceedanceRow::normativeValue),
            Column.of("Кратность", PekReportDocValues.ExceedanceRow::ratio),
            Column.of("Статус", PekReportDocValues.ExceedanceRow::status),
            Column.of("Корректирующее мероприятие", PekReportDocValues.ExceedanceRow::correctiveAction));

    private static final List<Column<PekReportDocValues.ProtocolRow>> PROTOCOL_COLUMNS = List.of(
            Column.of("Номер протокола", PekReportDocValues.ProtocolRow::number),
            Column.of("Дата", PekReportDocValues.ProtocolRow::date),
            Column.of("Лаборатория", PekReportDocValues.ProtocolRow::laboratory));

    public static byte[] render(OfficialPekReportDocValues v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PekDocxWriter.normativeHeader(doc, v.regulationVersion(), v.templateVersion());
            PekDocxWriter.title(doc, "ОТЧЁТ ПО РЕЗУЛЬТАТАМ ПРОИЗВОДСТВЕННОГО ЭКОЛОГИЧЕСКОГО КОНТРОЛЯ");
            PekDocxWriter.subtitle(doc, "№ " + PekDocxWriter.nz(v.reportNumber())
                    + "  (версия документа " + v.version() + ")");

            int section = 1;

            PekDocxWriter.heading(doc, section++ + ". Общие сведения");
            PekDocxWriter.fieldTable(doc, generalInfoRows(v));

            PekDocxWriter.heading(doc, section++ + ". Действующие разрешительные документы");
            PekDocxWriter.table(doc, PERMIT_COLUMNS, v.permits(),
                    "Разрешительные документы отсутствуют.");

            PekDocxWriter.heading(doc, section++ + ". Производственный мониторинг");
            PekDocxWriter.table(doc, MONITORING_COLUMNS, v.monitoring(),
                    "Направления производственного мониторинга не заявлены.");

            if (v.applicableAir()) {
                PekDocxWriter.heading(doc, section++ + ". Атмосферный воздух: источники выбросов");
                PekDocxWriter.table(doc, EMISSION_COLUMNS, v.emissionSources(),
                        "Источники выбросов не внесены в программу.");
            }
            if (v.applicableWater()) {
                PekDocxWriter.heading(doc, section++ + ". Сточные воды: выпуски");
                PekDocxWriter.table(doc, DISCHARGE_COLUMNS, v.dischargeSources(),
                        "Выпуски сточных вод не внесены в программу.");
            }
            if (v.applicableWaste()) {
                PekDocxWriter.heading(doc, section++ + ". Отходы: накопление и движение за отчётный период");
                PekDocxWriter.table(doc, WASTE_COLUMNS, v.waste(),
                        "Виды отходов не внесены в программу.");
                // Stated, never silently corrected: the reported closing balance is what the
                // operator entered, and a balance that does not add up is a fact the reader needs.
                List<String> unreconciled = v.waste().stream()
                        .filter(w -> !w.reconciles())
                        .map(OfficialPekReportDocValues.WasteRow::name)
                        .toList();
                if (!unreconciled.isEmpty()) {
                    PekDocxWriter.paragraph(doc, "Внимание: остаток на конец периода не сходится с расчётным "
                            + "(остаток на начало + образование − передача − удаление) по видам отходов: "
                            + String.join(", ", unreconciled));
                }
            }

            PekDocxWriter.heading(doc, section++ + ". Выполнение программы производственного контроля");
            PekDocxWriter.table(doc, PLAN_FACT_COLUMNS, v.planFactRows(),
                    "Данные о выполнении программы отсутствуют.");

            PekDocxWriter.heading(doc, section++ + ". Превышения нормативов и корректирующие мероприятия");
            PekDocxWriter.table(doc, EXCEEDANCE_COLUMNS, v.exceedances(),
                    "Превышений нормативов за отчётный период не зафиксировано.");

            PekDocxWriter.heading(doc, section++ + ". Протоколы лабораторных испытаний");
            PekDocxWriter.table(doc, PROTOCOL_COLUMNS, v.protocols(),
                    "Протоколы лабораторных испытаний к отчёту не приложены.");

            PekDocxWriter.heading(doc, section + ". Подписи");
            PekDocxWriter.signatureLine(doc, "Ответственный за ПЭК", v.responsibleUserName());
            PekDocxWriter.signatureLine(doc, "Руководитель организации", v.headOfOrganizationName());
            PekDocxWriter.paragraph(doc, "Дата формирования документа: "
                    + PekDocxWriter.nz(v.generatedAtLabel()));

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static List<String[]> generalInfoRows(OfficialPekReportDocValues v) {
        OfficialPekReportDocValues.GeneralInfo g = v.generalInfo();
        List<String[]> rows = new ArrayList<>();
        if (g == null) {
            return rows;
        }
        rows.add(new String[]{"Наименование организации", g.companyName()});
        rows.add(new String[]{"БИН", g.companyBin()});
        rows.add(new String[]{"Юридический адрес", g.legalAddress()});
        rows.add(new String[]{"Фактический адрес", g.actualAddress()});
        rows.add(new String[]{"Телефон", g.phone()});
        rows.add(new String[]{"Наименование объекта", g.objectName()});
        rows.add(new String[]{"Адрес объекта", g.objectAddress()});
        rows.add(new String[]{"КАТО", g.kato()});
        rows.add(new String[]{"ОКЭД", g.oked()});
        rows.add(new String[]{"Категория объекта", g.environmentalCategory()});
        rows.add(new String[]{"Координаты объекта", g.coordinates()});
        rows.add(new String[]{"Характеристика производства", g.productionCharacteristics()});
        rows.add(new String[]{"Проектная мощность", g.designCapacity()});
        rows.add(new String[]{"Фактическая мощность", g.actualCapacity()});
        rows.add(new String[]{"Программа ПЭК", join(g.programNumber(), g.programName())});
        rows.add(new String[]{"Срок действия программы", period(g.programValidFrom(), g.programValidUntil())});
        rows.add(new String[]{"Вид отчёта", v.reportType()});
        rows.add(new String[]{"Отчётный период", v.periodLabel()});
        rows.add(new String[]{"Период с / по", period(v.periodStart(), v.periodEnd())});
        rows.add(new String[]{"Срок представления", v.submissionDueDate()});
        return rows;
    }

    private static String join(String a, String b) {
        if (a == null || a.isBlank()) return b;
        if (b == null || b.isBlank()) return a;
        return a + " " + b;
    }

    private static String period(String from, String to) {
        if (from == null && to == null) return null;
        return PekDocxWriter.nz(from) + " — " + PekDocxWriter.nz(to);
    }
}
