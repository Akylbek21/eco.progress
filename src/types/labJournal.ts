export enum JournalType {
  WATER_ANALYTICAL_CONTROL = 'WATER_ANALYTICAL_CONTROL',
  CHEMICAL_REAGENT_USAGE = 'CHEMICAL_REAGENT_USAGE',
  TEST_PROTOCOL_REGISTRATION = 'TEST_PROTOCOL_REGISTRATION',
  INTRODUCTORY_BRIEFING = 'INTRODUCTORY_BRIEFING',
  REAGENT_PREPARATION = 'REAGENT_PREPARATION',
}

export type JournalColumnType = 'text' | 'number' | 'date';

export type JournalColumn = {
  key: string;
  title: string;
  type: JournalColumnType;
};

export type JournalTypeDefinition = {
  code: JournalType;
  title: string;
  columns: JournalColumn[];
};

export const JOURNAL_TYPES: JournalTypeDefinition[] = [
  {
    code: JournalType.WATER_ANALYTICAL_CONTROL,
    title: 'Журнал регистрации результатов аналитического контроля загрязнения вод',
    columns: [
      { key: 'rowNumber', title: '№', type: 'number' },
      { key: 'registrationDate', title: 'Дата регистрации', type: 'date' },
      { key: 'dryThermometer', title: 'Показания сухого термометра', type: 'text' },
      { key: 'wetThermometer', title: 'Показания влажного термометра', type: 'text' },
      { key: 'relativeHumidity', title: 'Относительная влажность', type: 'text' },
      { key: 'responsiblePerson', title: 'Ответственный', type: 'text' },
    ],
  },
  {
    code: JournalType.CHEMICAL_REAGENT_USAGE,
    title: 'Журнал учета поступления и расхода химических веществ',
    columns: [
      { key: 'rowNumber', title: '№', type: 'number' },
      { key: 'date', title: 'Дата', type: 'date' },
      { key: 'substanceName', title: 'Наименование вещества', type: 'text' },
      { key: 'formula', title: 'Формула', type: 'text' },
      { key: 'unit', title: 'Ед. изм.', type: 'text' },
      { key: 'incomingQuantity', title: 'Приход кол-во', type: 'number' },
      { key: 'outgoingQuantity', title: 'Расход кол-во', type: 'number' },
      { key: 'balance', title: 'Остаток', type: 'number' },
      { key: 'basis', title: 'Основание', type: 'text' },
      { key: 'purpose', title: 'Цель использования', type: 'text' },
      { key: 'responsiblePerson', title: 'ФИО ответственное лицо', type: 'text' },
      { key: 'signature', title: 'Подпись', type: 'text' },
    ],
  },
  {
    code: JournalType.TEST_PROTOCOL_REGISTRATION,
    title: 'Журнал регистрации и выдачи протоколов испытаний',
    columns: [
      { key: 'rowNumber', title: '№ п/п', type: 'number' },
      { key: 'protocolRegistrationDate', title: 'Дата регистрации протокола', type: 'date' },
      { key: 'testBasis', title: 'Основание проведения испытаний', type: 'text' },
      { key: 'customerName', title: 'Наименование заказчика', type: 'text' },
      { key: 'samplingPlace', title: 'Место отбора проб', type: 'text' },
      { key: 'protocolIssueDate', title: 'Дата выдачи протокола', type: 'date' },
      { key: 'responsiblePerson', title: 'ФИО ответственного за выдачу', type: 'text' },
      { key: 'recipientName', title: 'ФИО получателя', type: 'text' },
      { key: 'recipientSignature', title: 'Подпись получателя', type: 'text' },
      { key: 'note', title: 'Примечание', type: 'text' },
    ],
  },
  {
    code: JournalType.INTRODUCTORY_BRIEFING,
    title: 'Журнал регистрации вводного инструктажа',
    columns: [
      { key: 'rowNumber', title: '№', type: 'number' },
      { key: 'date', title: 'Дата', type: 'date' },
      { key: 'fullName', title: 'Ф.И.О. инструктируемого', type: 'text' },
      { key: 'birthYear', title: 'Год рождения', type: 'text' },
      { key: 'profession', title: 'Профессия, должность', type: 'text' },
      { key: 'department', title: 'Наименование производственного подразделения', type: 'text' },
      { key: 'instructorName', title: 'Ф.И.О., должность инструктирующего', type: 'text' },
      { key: 'instructorSignature', title: 'Подпись инструктирующего', type: 'text' },
      { key: 'employeeSignature', title: 'Подпись инструктируемого', type: 'text' },
    ],
  },
  {
    code: JournalType.REAGENT_PREPARATION,
    title: 'Журнал регистрации приготовления реактивов',
    columns: [
      { key: 'rowNumber', title: '№ п/п', type: 'number' },
      { key: 'preparationDate', title: 'Дата приготовления', type: 'date' },
      { key: 'reagentName', title: 'Наименование реактивов', type: 'text' },
      { key: 'takenAmount', title: 'Вес взятого реактива', type: 'text' },
      { key: 'preparedVolume', title: 'Объем приготовленного реактива', type: 'text' },
      { key: 'preparedReagentName', title: 'Название приготовленного реактива', type: 'text' },
      { key: 'preparedBy', title: 'Кем приготовлен реактив', type: 'text' },
      { key: 'methodDocument', title: 'Методы, инструкция и НД', type: 'text' },
    ],
  },
];

export type LabJournalValue = string | number | null;
export type LabJournalEntryData = Record<string, LabJournalValue>;

export type LabJournalEntry = {
  id: string;
  journalType: JournalType;
  rowNumber?: number;
  entryDate?: string;
  data: LabJournalEntryData;
  laboratoryId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LabJournalPage = {
  content: LabJournalEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type LabJournalQuery = {
  journalType: JournalType;
  page?: number;
  size?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  laboratoryId?: string | number;
};

export type SaveLabJournalEntryPayload = {
  journalType: JournalType;
  entryDate?: string;
  data: LabJournalEntryData;
  laboratoryId?: string | number;
};

export type ExportLabJournalParams = Omit<LabJournalQuery, 'page' | 'size' | 'search'> & {
  template?: boolean;
};
