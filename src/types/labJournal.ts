export const JOURNAL_SCHEMA_VERSION = 2;

export const JournalType = {
  SAMPLE_REGISTRATION: 'SAMPLE_REGISTRATION',
  SOLUTION_PREPARATION: 'SOLUTION_PREPARATION',
  CHEMICAL_REAGENT_MOVEMENT: 'CHEMICAL_REAGENT_MOVEMENT',
  ENVIRONMENT_CONDITIONS: 'ENVIRONMENT_CONDITIONS',
  TEST_RESULTS_REGISTRATION: 'TEST_RESULTS_REGISTRATION',
} as const;

export type LabJournalType = typeof JournalType[keyof typeof JournalType];
/** @deprecated Use LabJournalType. */
export type JournalType = LabJournalType;

export type JournalColumnType =
  | 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'boolean'
  | 'employee' | 'laboratory' | 'measurement_device' | 'company' | 'company_object'
  | 'protocol' | 'calculated';

export interface JournalColumn {
  key: string;
  title: string;
  type: JournalColumnType;
  required: boolean;
  readOnly: boolean;
  searchable?: boolean;
  sortable?: boolean;
  width?: number;
  options?: Array<{ value: string; label: string }>;
  validation?: { min?: number; max?: number; pattern?: string };
}

export interface JournalTypeDefinition {
  code: LabJournalType;
  title: string;
  description?: string;
  schemaVersion?: number;
  columns: JournalColumn[];
}

const column = (key: string, title: string, type: JournalColumnType = 'text', required = false, readOnly = false): JournalColumn => ({ key, title, type, required, readOnly });

export const JOURNAL_TYPES: JournalTypeDefinition[] = [
  { code: JournalType.SAMPLE_REGISTRATION, title: 'Журнал регистрации проб', schemaVersion: JOURNAL_SCHEMA_VERSION, columns: [
    column('registrationDate', 'Дата регистрации', 'date', true), column('sampleNumber', 'Номер пробы', 'text', true), column('sampleName', 'Наименование пробы', 'text', true), column('sampleType', 'Тип пробы'), column('companyId', 'Заказчик', 'company', true), column('companyObjectId', 'Объект', 'company_object', true), column('samplingPlace', 'Место отбора'), column('samplingDate', 'Дата отбора', 'date'), column('samplingTime', 'Время отбора', 'time'), column('receivedDate', 'Дата поступления', 'date'), column('receivedTime', 'Время поступления', 'time'), column('receivedByEmployeeId', 'Принял', 'employee'), column('sampledByEmployeeId', 'Отобрал пробу', 'employee'), column('receiptCondition', 'Состояние при поступлении', 'textarea'), column('notes', 'Примечание', 'textarea'),
  ]},
  { code: JournalType.SOLUTION_PREPARATION, title: 'Журнал приготовления растворов', schemaVersion: JOURNAL_SCHEMA_VERSION, columns: [
    column('preparationDate', 'Дата приготовления', 'date', true), column('solutionName', 'Название раствора', 'text', true), column('reagentName', 'Реактив', 'text', true), column('concentration', 'Концентрация', 'number', true), column('concentrationUnit', 'Единица концентрации', 'text', true), column('preparedVolume', 'Приготовленный объём', 'number', true), column('volumeUnit', 'Единица объёма', 'text', true), column('reagentBatchNumber', 'Номер партии реактива'), column('reagentExpiryDate', 'Срок годности реактива', 'date'), column('preparationMethod', 'Метод приготовления', 'textarea'), column('preparedByEmployeeId', 'Приготовил', 'employee', true), column('checkedByEmployeeId', 'Проверил', 'employee'), column('solutionExpiryDate', 'Срок годности раствора', 'date'), column('storageConditions', 'Условия хранения'), column('notes', 'Примечание', 'textarea'),
  ]},
  { code: JournalType.CHEMICAL_REAGENT_MOVEMENT, title: 'Журнал движения химических реактивов', schemaVersion: JOURNAL_SCHEMA_VERSION, columns: [
    column('operationDate', 'Дата операции', 'date', true), column('reagentName', 'Реактив', 'text', true), column('reagentCode', 'Код реактива'), column('batchNumber', 'Номер партии'), column('unit', 'Единица', 'text', true), column('incomingQuantity', 'Приход', 'number'), column('outgoingQuantity', 'Расход', 'number'), column('remainingQuantity', 'Остаток', 'calculated', false, true), column('supplier', 'Поставщик'), column('documentNumber', 'Номер документа'), column('receivedByEmployeeId', 'Принял', 'employee'), column('issuedTo', 'Выдано кому'), column('purpose', 'Назначение'), column('storageLocation', 'Место хранения'), column('expiryDate', 'Срок годности', 'date'), column('notes', 'Примечание', 'textarea'),
  ]},
  { code: JournalType.ENVIRONMENT_CONDITIONS, title: 'Журнал регистрации условий окружающей среды', schemaVersion: JOURNAL_SCHEMA_VERSION, columns: [
    column('registrationDate', 'Дата', 'date', true), column('registrationTime', 'Время', 'time', true), column('room', 'Помещение', 'text', true), column('measurementPlace', 'Место измерения'), column('temperatureCelsius', 'Температура, °C', 'number', true), { ...column('relativeHumidityPercent', 'Относительная влажность, %', 'number', true), validation: { min: 0, max: 100 } }, column('pressureKpa', 'Давление, кПа', 'number'), column('windSpeedMs', 'Скорость воздуха, м/с', 'number'), column('dryBulbTemperatureCelsius', 'Сухой термометр', 'number'), column('wetBulbTemperatureCelsius', 'Влажный термометр', 'number'), column('measurementDeviceId', 'Прибор', 'measurement_device', true), column('measuredByEmployeeId', 'Измерил', 'employee', true), column('notes', 'Примечание', 'textarea'),
  ]},
  { code: JournalType.TEST_RESULTS_REGISTRATION, title: 'Журнал регистрации результатов испытаний', schemaVersion: JOURNAL_SCHEMA_VERSION, columns: [
    column('registrationDate', 'Дата регистрации', 'date', true), column('protocolId', 'Номер протокола', 'protocol', true), column('companyId', 'Заказчик', 'company'), column('companyObjectId', 'Объект', 'company_object'), column('sampleNumber', 'Номер пробы'), column('testType', 'Вид испытания'), column('indicatorName', 'Показатель', 'text', true), column('resultValue', 'Результат', 'text', true), column('unit', 'Единица'), column('normativeValue', 'Норматив'), column('normativeDocument', 'Нормативный документ'), column('compliance', 'Соответствие', 'select'), column('executorEmployeeId', 'Исполнитель', 'employee'), column('approvedByEmployeeId', 'Утвердил', 'employee'), column('issueDate', 'Дата выдачи', 'date'), column('notes', 'Примечание', 'textarea'),
  ]},
];

export type JournalValue = string | number | boolean | null;
export type JournalValues = Record<string, unknown>;

export interface JournalEntry {
  id: number;
  journalType: LabJournalType;
  laboratoryId: number;
  values: JournalValues;
  version: number;
  archived: boolean;
  automatic?: boolean;
  protocolId?: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  items: T[]; page: number; size: number; totalElements: number; totalPages: number;
  first: boolean; last: boolean; hasNext: boolean; hasPrevious: boolean;
}

export interface JournalEntriesParams {
  journalType: LabJournalType;
  laboratoryId?: number;
  page: number;
  size: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: number;
  archived?: boolean;
  sort?: string;
  filters?: Record<string, string | number | boolean>;
}

export interface JournalEntryPayload {
  journalType: LabJournalType;
  laboratoryId: number;
  values: JournalValues;
  version?: number;
}

export type ExportJournalParams = Omit<JournalEntriesParams, 'page' | 'size'>;

/** Transitional aliases for existing imports. */
export type LabJournalEntry = JournalEntry;
export type LabJournalEntryData = JournalValues;
export type LabJournalValue = JournalValue;
export type LabJournalPage = PageResponse<JournalEntry>;
export type LabJournalQuery = JournalEntriesParams;
export type SaveLabJournalEntryPayload = JournalEntryPayload;
export type ExportLabJournalParams = ExportJournalParams;
