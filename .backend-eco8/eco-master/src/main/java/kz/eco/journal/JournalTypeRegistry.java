package kz.eco.journal;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class JournalTypeRegistry {

    private static final Map<JournalType, JournalDefinition> DEFINITIONS = new EnumMap<>(JournalType.class);

    static {
        register(new JournalDefinition(
                JournalType.ENVIRONMENT_CONDITIONS,
                "Журнал регистрации условий окружающей среды",
                "registrationDate",
                List.of(
                        new JournalColumn("rowNumber", "№", "number"),
                        new JournalColumn("registrationDate", "Дата регистрации", "date"),
                        new JournalColumn("dryThermometer", "Показания сухого термометра", "text"),
                        new JournalColumn("wetThermometer", "Показания влажного термометра", "text"),
                        new JournalColumn("relativeHumidity", "Относительная влажность", "text"),
                        new JournalColumn("responsiblePerson", "Ответственный", "text")
                ),
                List.of("registrationDate", "responsiblePerson")));

        register(new JournalDefinition(
                JournalType.CHEMICAL_REAGENT_USAGE,
                "Журнал учета поступления и расхода химических веществ",
                "date",
                List.of(
                        new JournalColumn("rowNumber", "№", "number"),
                        new JournalColumn("date", "Дата", "date"),
                        new JournalColumn("substanceName", "Наименование вещества", "text"),
                        new JournalColumn("formula", "Формула", "text"),
                        new JournalColumn("unit", "Ед. изм.", "text"),
                        new JournalColumn("incomingQuantity", "Приход кол-во", "number"),
                        new JournalColumn("outgoingQuantity", "Расход кол-во", "number"),
                        new JournalColumn("balance", "Остаток", "number"),
                        new JournalColumn("basis", "Основание", "text"),
                        new JournalColumn("purpose", "Цель использования", "text"),
                        new JournalColumn("responsiblePerson", "ФИО ответственное лицо", "text"),
                        new JournalColumn("signature", "Подпись", "text")
                ),
                // incomingQuantity/outgoingQuantity are validated separately (either one, not
                // both, may legitimately be absent) - see LabJournalService.applyChemicalBalance.
                List.of("date", "substanceName", "unit")));

        register(new JournalDefinition(
                JournalType.TEST_RESULTS_REGISTRATION,
                "Журнал регистрации результатов испытаний",
                "protocolRegistrationDate",
                List.of(
                        new JournalColumn("rowNumber", "№ п/п", "number"),
                        new JournalColumn("protocolRegistrationDate", "Дата регистрации протокола", "date"),
                        new JournalColumn("testBasis", "Основание проведения испытаний", "text"),
                        new JournalColumn("customerName", "Наименование заказчика", "text"),
                        new JournalColumn("samplingPlace", "Место отбора проб", "text"),
                        new JournalColumn("protocolIssueDate", "Дата выдачи протокола", "date"),
                        new JournalColumn("responsiblePerson", "ФИО ответственного за выдачу", "text"),
                        new JournalColumn("recipientName", "ФИО получателя", "text"),
                        new JournalColumn("recipientSignature", "Подпись получателя", "text"),
                        new JournalColumn("note", "Примечание", "text")
                ),
                List.of("protocolRegistrationDate", "customerName")));

        register(new JournalDefinition(
                JournalType.SAMPLE_REGISTRATION,
                "Журнал регистрации проб",
                "date",
                List.of(
                        new JournalColumn("rowNumber", "№", "number"),
                        new JournalColumn("date", "Дата", "date"),
                        new JournalColumn("fullName", "Ф.И.О. инструктируемого", "text"),
                        new JournalColumn("birthYear", "Год рождения", "text"),
                        new JournalColumn("profession", "Профессия, должность", "text"),
                        new JournalColumn("department", "Наименование производственного подразделения", "text"),
                        new JournalColumn("instructorName", "Ф.И.О., должность инструктирующего", "text"),
                        new JournalColumn("instructorSignature", "Подпись инструктирующего", "text"),
                        new JournalColumn("employeeSignature", "Подпись инструктируемого", "text")
                ),
                List.of("date", "fullName")));

        register(new JournalDefinition(
                JournalType.SOLUTION_PREPARATION,
                "Журнал приготовления растворов",
                "preparationDate",
                List.of(
                        new JournalColumn("rowNumber", "№ п/п", "number"),
                        new JournalColumn("preparationDate", "Дата приготовления", "date"),
                        new JournalColumn("reagentName", "Наименование реактивов", "text"),
                        new JournalColumn("takenAmount", "Вес взятого реактива", "text"),
                        new JournalColumn("preparedVolume", "Объем приготовленного реактива", "text"),
                        new JournalColumn("preparedReagentName", "Название приготовленного реактива", "text"),
                        new JournalColumn("preparedBy", "Кем приготовлен реактив", "text"),
                        new JournalColumn("methodDocument", "Методы, инструкция и НД", "text")
                ),
                List.of("preparationDate", "reagentName", "preparedBy")));
    }

    private static void register(JournalDefinition definition) {
        DEFINITIONS.put(definition.code(), definition);
    }

    private JournalTypeRegistry() {
    }

    public static JournalDefinition get(JournalType type) {
        return DEFINITIONS.get(type);
    }

    public static List<JournalDefinition> all() {
        return List.copyOf(DEFINITIONS.values());
    }
}
