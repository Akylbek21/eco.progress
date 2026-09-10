package kz.eco.pek.docgen;

import org.apache.poi.xwpf.usermodel.XWPFDocument;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static kz.eco.pek.docgen.PekDocxWriter.Column;

/**
 * Renders the PEK program document - the thing a company actually hands over as its programme.
 *
 * <p>Replaces the four-line placeholder that used to be built inline inside the report-package
 * service. Every section the program is required to state now has a table here: what is controlled,
 * which indicators against which norms, where samples are taken, how measurement quality is
 * assured, what happens in an emergency, and who is responsible for what.
 *
 * <p>Component sections (air / water / waste) render only for components the program declares, the
 * same applicability rule readiness and the official report use.
 */
public final class PekProgramDocxRenderer {

    private PekProgramDocxRenderer() {
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
            Column.of("Точки отбора/измерений", OfficialPekReportDocValues.MonitoringRow::pointNames));

    private static final List<Column<PekProgramDocValues.ControlItemRow>> CONTROL_ITEM_COLUMNS = List.of(
            Column.of("Код", PekProgramDocValues.ControlItemRow::code),
            Column.of("Наименование", PekProgramDocValues.ControlItemRow::name),
            Column.of("Вид контроля", PekProgramDocValues.ControlItemRow::controlType),
            Column.of("Компонент среды", PekProgramDocValues.ControlItemRow::environmentComponent),
            Column.of("Периодичность", PekProgramDocValues.ControlItemRow::frequency),
            Column.of("План, раз", PekProgramDocValues.ControlItemRow::plannedCount),
            Column.of("Метод измерений", PekProgramDocValues.ControlItemRow::measurementMethod),
            Column.of("Метод отбора проб", PekProgramDocValues.ControlItemRow::samplingMethod),
            Column.of("Период", PekProgramDocValues.ControlItemRow::period));

    private static final List<Column<PekProgramDocValues.IndicatorRow>> INDICATOR_COLUMNS = List.of(
            Column.of("Позиция контроля", PekProgramDocValues.IndicatorRow::controlItemName),
            Column.of("Код", PekProgramDocValues.IndicatorRow::code),
            Column.of("Показатель", PekProgramDocValues.IndicatorRow::name),
            Column.of("Ед. изм.", PekProgramDocValues.IndicatorRow::unit),
            Column.of("Норматив", PekProgramDocValues.IndicatorRow::normativeValue),
            Column.of("Условие", PekProgramDocValues.IndicatorRow::comparison),
            Column.of("Диапазон", PekProgramDocValues.IndicatorRow::range),
            Column.of("Средство измерений", PekProgramDocValues.IndicatorRow::measurementDeviceType),
            Column.of("Обязательный", r -> r.mandatory() ? "да" : "нет"));

    private static final List<Column<OfficialPekReportDocValues.EmissionSourceRow>> EMISSION_COLUMNS = List.of(
            Column.of("№ источника", OfficialPekReportDocValues.EmissionSourceRow::code),
            Column.of("Наименование", OfficialPekReportDocValues.EmissionSourceRow::name),
            Column.of("Тип", OfficialPekReportDocValues.EmissionSourceRow::sourceType),
            Column.of("Цех/участок", OfficialPekReportDocValues.EmissionSourceRow::workshopName),
            Column.of("Высота, м", OfficialPekReportDocValues.EmissionSourceRow::heightM),
            Column.of("Диаметр, м", OfficialPekReportDocValues.EmissionSourceRow::diameterM),
            Column.of("Координаты", OfficialPekReportDocValues.EmissionSourceRow::coordinates),
            Column.of("Газоочистка", OfficialPekReportDocValues.EmissionSourceRow::gasCleaningEquipment),
            Column.of("Степень очистки, %", OfficialPekReportDocValues.EmissionSourceRow::cleaningEfficiencyPercent));

    private static final List<Column<OfficialPekReportDocValues.DischargeSourceRow>> DISCHARGE_COLUMNS = List.of(
            Column.of("№ выпуска", OfficialPekReportDocValues.DischargeSourceRow::code),
            Column.of("Наименование", OfficialPekReportDocValues.DischargeSourceRow::name),
            Column.of("Водоприёмник", OfficialPekReportDocValues.DischargeSourceRow::receivingWaterBody),
            Column.of("Вид сброса", OfficialPekReportDocValues.DischargeSourceRow::dischargeType),
            Column.of("Координаты", OfficialPekReportDocValues.DischargeSourceRow::coordinates),
            Column.of("Разрешённый объём", r -> joinUnit(r.permittedVolume(), r.volumeUnit())),
            Column.of("Очистные сооружения", OfficialPekReportDocValues.DischargeSourceRow::treatmentFacilities));

    private static final List<Column<PekProgramDocValues.WasteCatalogueRow>> WASTE_COLUMNS = List.of(
            Column.of("Вид отхода", PekProgramDocValues.WasteCatalogueRow::name),
            Column.of("Код", PekProgramDocValues.WasteCatalogueRow::code),
            Column.of("Класс опасности", PekProgramDocValues.WasteCatalogueRow::hazardClass),
            Column.of("Лимит накопления", r -> joinUnit(r.accumulationLimit(), r.limitUnit())),
            Column.of("Срок накопления, сут.", PekProgramDocValues.WasteCatalogueRow::accumulationPeriodDays),
            Column.of("Место накопления", PekProgramDocValues.WasteCatalogueRow::storageSiteName),
            Column.of("Координаты", PekProgramDocValues.WasteCatalogueRow::coordinates));

    private static final List<Column<PekProgramDocValues.InspectionRow>> INSPECTION_COLUMNS = List.of(
            Column.of("Планируемая дата", PekProgramDocValues.InspectionRow::plannedDate),
            Column.of("Вид проверки", PekProgramDocValues.InspectionRow::inspectionType),
            Column.of("Статус", PekProgramDocValues.InspectionRow::status),
            Column.of("Ответственный", PekProgramDocValues.InspectionRow::responsible));

    private static final List<Column<PekProgramDocValues.MeasurementQaRow>> QA_COLUMNS = List.of(
            Column.of("Параметр", PekProgramDocValues.MeasurementQaRow::parameter),
            Column.of("Процедура контроля качества", PekProgramDocValues.MeasurementQaRow::qaProcedure),
            Column.of("Периодичность", PekProgramDocValues.MeasurementQaRow::frequency),
            Column.of("Последняя проверка", PekProgramDocValues.MeasurementQaRow::lastCheckDate),
            Column.of("Следующая проверка", PekProgramDocValues.MeasurementQaRow::nextCheckDate));

    private static final List<Column<PekProgramDocValues.EmergencyRow>> EMERGENCY_COLUMNS = List.of(
            Column.of("Сценарий", PekProgramDocValues.EmergencyRow::scenario),
            Column.of("Действия", PekProgramDocValues.EmergencyRow::actions),
            Column.of("Контактный телефон", PekProgramDocValues.EmergencyRow::contactPhone));

    private static final List<Column<PekProgramDocValues.ResponsibilityRow>> RESPONSIBILITY_COLUMNS = List.of(
            Column.of("Роль", PekProgramDocValues.ResponsibilityRow::roleLabel),
            Column.of("Сотрудник", PekProgramDocValues.ResponsibilityRow::userName),
            Column.of("Обязанности", PekProgramDocValues.ResponsibilityRow::duties));

    public static byte[] render(PekProgramDocValues v) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PekDocxWriter.normativeHeader(doc, v.regulationVersion(), v.templateVersion());
            PekDocxWriter.title(doc, "ПРОГРАММА ПРОИЗВОДСТВЕННОГО ЭКОЛОГИЧЕСКОГО КОНТРОЛЯ");
            PekDocxWriter.subtitle(doc, "№ " + PekDocxWriter.nz(v.number()) + " — " + PekDocxWriter.nz(v.name()));

            int section = 1;

            PekDocxWriter.heading(doc, section++ + ". Общие сведения об объекте");
            PekDocxWriter.fieldTable(doc, generalInfoRows(v));

            if (notBlank(v.description()) || notBlank(v.monitoringScope())) {
                PekDocxWriter.heading(doc, section++ + ". Область и назначение программы");
                if (notBlank(v.description())) PekDocxWriter.paragraph(doc, v.description());
                if (notBlank(v.monitoringScope())) PekDocxWriter.paragraph(doc, v.monitoringScope());
            }

            PekDocxWriter.heading(doc, section++ + ". Разрешительные документы");
            PekDocxWriter.table(doc, PERMIT_COLUMNS, v.permits(), "Разрешительные документы не привязаны.");

            PekDocxWriter.heading(doc, section++ + ". Направления производственного мониторинга и точки контроля");
            PekDocxWriter.table(doc, MONITORING_COLUMNS, v.monitoring(),
                    "Направления производственного мониторинга не заявлены.");

            PekDocxWriter.heading(doc, section++ + ". Позиции контроля, методы и периодичность");
            PekDocxWriter.table(doc, CONTROL_ITEM_COLUMNS, v.controlItems(), "Позиции контроля не заданы.");

            PekDocxWriter.heading(doc, section++ + ". Контролируемые показатели и нормативы");
            PekDocxWriter.table(doc, INDICATOR_COLUMNS, v.indicators(), "Контролируемые показатели не заданы.");

            if (v.applicableAir()) {
                PekDocxWriter.heading(doc, section++ + ". Источники выбросов в атмосферный воздух");
                PekDocxWriter.table(doc, EMISSION_COLUMNS, v.emissionSources(), "Источники выбросов не внесены.");
            }
            if (v.applicableWater()) {
                PekDocxWriter.heading(doc, section++ + ". Выпуски сточных вод");
                PekDocxWriter.table(doc, DISCHARGE_COLUMNS, v.dischargeSources(), "Выпуски сточных вод не внесены.");
            }
            if (v.applicableWaste()) {
                PekDocxWriter.heading(doc, section++ + ". Отходы и условия их накопления");
                PekDocxWriter.table(doc, WASTE_COLUMNS, v.wasteItems(), "Виды отходов не внесены.");
            }

            PekDocxWriter.heading(doc, section++ + ". Внутренние проверки");
            PekDocxWriter.table(doc, INSPECTION_COLUMNS, v.internalInspections(),
                    "Внутренние проверки не запланированы.");

            PekDocxWriter.heading(doc, section++ + ". Контроль качества измерений");
            PekDocxWriter.table(doc, QA_COLUMNS, v.measurementQa(),
                    "Процедуры контроля качества измерений не заданы.");

            PekDocxWriter.heading(doc, section++ + ". Действия при аварийных ситуациях");
            PekDocxWriter.table(doc, EMERGENCY_COLUMNS, v.emergencyProcedures(),
                    "Действия при аварийных ситуациях не заданы.");

            PekDocxWriter.heading(doc, section++ + ". Структура ответственности");
            PekDocxWriter.table(doc, RESPONSIBILITY_COLUMNS, v.responsibilities(),
                    "Структура ответственности не заполнена.");

            PekDocxWriter.heading(doc, section + ". Подписи");
            PekDocxWriter.signatureLine(doc, "Ответственный за ПЭК", v.responsibleUserName());
            PekDocxWriter.signatureLine(doc, "Руководитель организации", v.headOfOrganizationName());
            PekDocxWriter.paragraph(doc, "Дата формирования документа: " + PekDocxWriter.nz(v.generatedAtLabel())
                    + " (редакция содержания программы: " + v.contentRevision() + ")");

            doc.write(out);
            return out.toByteArray();
        }
    }

    private static List<String[]> generalInfoRows(PekProgramDocValues v) {
        List<String[]> rows = new ArrayList<>();
        OfficialPekReportDocValues.GeneralInfo g = v.generalInfo();
        if (g != null) {
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
        }
        rows.add(new String[]{"Статус программы", v.status()});
        rows.add(new String[]{"Срок действия программы",
                PekDocxWriter.nz(v.validFrom()) + " — " + PekDocxWriter.nz(v.validUntil())});
        return rows;
    }

    private static String joinUnit(String value, String unit) {
        if (value == null || value.isBlank()) return null;
        return unit == null || unit.isBlank() ? value : value + " " + unit;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
