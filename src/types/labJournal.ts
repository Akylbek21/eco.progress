export const JournalType = {
  SOLUTION_PREPARATION: 'SOLUTION_PREPARATION',
  CHEMICAL_REAGENT_USAGE: 'CHEMICAL_REAGENT_USAGE',
  ENVIRONMENT_CONDITIONS: 'ENVIRONMENT_CONDITIONS',
  SAMPLE_REGISTRATION: 'SAMPLE_REGISTRATION',
  TEST_RESULTS_REGISTRATION: 'TEST_RESULTS_REGISTRATION',
} as const;

export type JournalType = typeof JournalType[keyof typeof JournalType] | string;

export type JournalKind = 'solution' | 'chemical' | 'environment' | 'sample' | 'results' | 'custom';

export type JournalColumnType = 'text' | 'number' | 'date' | 'time' | 'textarea';

export type JournalColumn = {
  key: string;
  title: string;
  type: JournalColumnType;
  required?: boolean;
  readOnly?: boolean;
};

export type JournalTypeDefinition = {
  code: JournalType;
  title: string;
  displayName?: string;
  kind?: JournalKind;
  columns: JournalColumn[];
};

export const JOURNAL_TYPES: JournalTypeDefinition[] = [
  {
    code: JournalType.SOLUTION_PREPARATION,
    title: 'Журнал приготовления растворов',
    kind: 'solution',
    columns: [
      { key: 'solutionName', title: 'Название раствора', type: 'text', required: true },
      { key: 'concentration', title: 'Концентрация', type: 'text' },
      { key: 'preparedDate', title: 'Дата приготовления', type: 'date', required: true },
      { key: 'expiryDate', title: 'Срок годности', type: 'date' },
      { key: 'preparedBy', title: 'Приготовил', type: 'text' },
      { key: 'componentName', title: 'Компонент', type: 'text' },
      { key: 'componentAmount', title: 'Количество компонента', type: 'number' },
      { key: 'unit', title: 'Ед. изм.', type: 'text' },
      { key: 'note', title: 'Примечание', type: 'textarea' },
    ],
  },
  {
    code: JournalType.CHEMICAL_REAGENT_USAGE,
    title: 'Журнал учета химических веществ / реактивов',
    kind: 'chemical',
    columns: [
      { key: 'substanceName', title: 'Наименование вещества', type: 'text', required: true },
      { key: 'unit', title: 'Ед. изм.', type: 'text' },
      { key: 'income', title: 'Приход', type: 'number' },
      { key: 'expense', title: 'Расход', type: 'number' },
      { key: 'balance', title: 'Остаток', type: 'number', readOnly: true },
      { key: 'supplier', title: 'Поставщик', type: 'text' },
      { key: 'documentNumber', title: 'Номер документа', type: 'text' },
      { key: 'note', title: 'Примечание', type: 'textarea' },
    ],
  },
  {
    code: JournalType.ENVIRONMENT_CONDITIONS,
    title: 'Журнал контроля условий окружающей среды',
    kind: 'environment',
    columns: [
      { key: 'date', title: 'Дата', type: 'date', required: true },
      { key: 'time', title: 'Время', type: 'time' },
      { key: 'room', title: 'Помещение', type: 'text' },
      { key: 'temperature', title: 'Температура, °C', type: 'number' },
      { key: 'humidity', title: 'Влажность, %', type: 'number' },
      { key: 'pressure', title: 'Давление', type: 'number' },
      { key: 'note', title: 'Примечание', type: 'textarea' },
    ],
  },
  {
    code: JournalType.SAMPLE_REGISTRATION,
    title: 'Журнал регистрации проб',
    kind: 'sample',
    columns: [
      { key: 'sampleNumber', title: 'Номер пробы', type: 'text', required: true },
      { key: 'sampleName', title: 'Наименование пробы', type: 'text' },
      { key: 'objectName', title: 'Объект', type: 'text' },
      { key: 'samplingPlace', title: 'Место отбора', type: 'text' },
      { key: 'samplingDate', title: 'Дата отбора', type: 'date' },
      { key: 'samplingTime', title: 'Время отбора', type: 'time' },
      { key: 'customerName', title: 'Заказчик', type: 'text' },
      { key: 'responsiblePerson', title: 'Ответственный', type: 'text' },
      { key: 'note', title: 'Примечание', type: 'textarea' },
    ],
  },
  {
    code: JournalType.TEST_RESULTS_REGISTRATION,
    title: 'Журнал регистрации результатов / испытаний',
    kind: 'results',
    columns: [
      { key: 'protocolNumber', title: 'Номер протокола', type: 'text' },
      { key: 'sampleNumber', title: 'Номер пробы', type: 'text' },
      { key: 'indicatorName', title: 'Показатель', type: 'text', required: true },
      { key: 'result', title: 'Результат', type: 'text' },
      { key: 'unit', title: 'Ед. изм.', type: 'text' },
      { key: 'normative', title: 'Норматив', type: 'text' },
      { key: 'conclusion', title: 'Заключение', type: 'text' },
      { key: 'executorName', title: 'Исполнитель', type: 'text' },
      { key: 'note', title: 'Примечание', type: 'textarea' },
    ],
  },
];

export type LabJournalValue = string | number | boolean | null;
export type LabJournalEntryData = Record<string, LabJournalValue>;

export type LabJournalEntry = {
  id: string;
  journalType: JournalType;
  rowNumber?: number;
  entryDate?: string;
  data: LabJournalEntryData;
  laboratoryId?: string | number | null;
  laboratoryName?: string;
  createdBy?: string | number | null;
  createdByName?: string;
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
  journalType?: JournalType;
  laboratoryId?: string | number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  size?: number;
};

export type SaveLabJournalEntryPayload = {
  journalType: JournalType;
  entryDate?: string;
  preparationDate?: string;
  data: LabJournalEntryData;
  laboratoryId?: string | number;
};

export type ExportLabJournalParams = Omit<LabJournalQuery, 'page' | 'size' | 'search'>;
