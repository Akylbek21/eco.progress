import {
  JournalType,
  type JournalColumnDefinition,
  type JournalFieldType,
  type LabJournalFormValues,
  type LabJournalType,
} from '../../../types/labJournal';

const field = (
  key: string,
  title: string,
  type: JournalFieldType = 'text',
  required = false,
  constraints: Partial<JournalColumnDefinition> = {},
): JournalColumnDefinition => ({ key, title, type, required, ...constraints });

export const LOCAL_JOURNAL_SCHEMAS: Record<LabJournalType, JournalColumnDefinition[]> = {
  SAMPLE_REGISTRATION: [
    field('sampleNumber', 'Номер образца', 'text', true),
    field('sampleName', 'Наименование образца', 'text', true),
    field('customerName', 'Заказчик'),
    field('samplingPlace', 'Место отбора'),
    field('samplingDate', 'Дата отбора', 'date'),
    field('receivedDate', 'Дата поступления', 'date'),
    field('sampleCondition', 'Состояние образца', 'textarea'),
    field('quantity', 'Количество', 'number', false, { min: 0 }),
    field('unit', 'Единица измерения'),
  ],
  SOLUTION_PREPARATION: [
    field('solutionName', 'Наименование раствора'),
    field('concentration', 'Концентрация', 'number'),
    field('expirationDate', 'Срок годности', 'date'),
    field('volume', 'Объём', 'number', false, { min: 0 }),
    field('unit', 'Единица измерения'),
    field('reagentName', 'Использованный реактив'),
    field('reagentBatch', 'Партия реактива'),
    field('preparationMethod', 'Методика приготовления', 'textarea'),
    field('preparedBy', 'Приготовил'),
    field('checkedBy', 'Проверил'),
  ],
  CHEMICAL_REAGENT_USAGE: [
    field('reagentName', 'Наименование реактива', 'text', true),
    field('catalogNumber', 'Каталожный номер'),
    field('batchNumber', 'Номер партии'),
    field('manufacturer', 'Производитель'),
    field('receivedDate', 'Дата поступления', 'date'),
    field('expirationDate', 'Срок годности', 'date'),
    field('initialQuantity', 'Начальное количество', 'number', false, { min: 0 }),
    field('usedQuantity', 'Использовано', 'number', false, { min: 0 }),
    field('unit', 'Единица измерения'),
    field('usagePurpose', 'Цель использования', 'textarea'),
  ],
  ENVIRONMENT_CONDITIONS: [
    field('measurementDate', 'Дата', 'date'),
    field('measurementTime', 'Время'),
    field('roomName', 'Помещение'),
    field('temperature', 'Температура, °C', 'number', true, { min: -80, max: 100, step: 0.1 }),
    field('humidity', 'Влажность, %', 'number', true, { min: 0, max: 100, step: 0.1 }),
    field('pressure', 'Давление, кПа', 'number', false, { min: 0, step: 0.1 }),
    field('airVelocity', 'Скорость движения воздуха, м/с', 'number', false, { min: 0, step: 0.01 }),
    field('deviceName', 'Прибор'),
  ],
  TEST_RESULTS_REGISTRATION: [
    field('protocolNumber', 'Номер протокола'),
    field('sampleNumber', 'Номер образца'),
    field('testDate', 'Дата испытания', 'date'),
    field('indicatorName', 'Показатель', 'text', true),
    field('resultValue', 'Результат', 'text', true),
    field('unit', 'Единица измерения', 'text', true),
    field('normativeValue', 'Норматив'),
    field('compliance', 'Соответствие', 'select', false, { options: [
      { value: 'COMPLIES', label: 'Соответствует' },
      { value: 'DOES_NOT_COMPLY', label: 'Не соответствует' },
    ] }),
    field('methodDocument', 'Методика'),
    field('deviceName', 'Прибор'),
  ],
};

const supportedTypes = new Set<JournalFieldType>(['text', 'textarea', 'number', 'date', 'datetime', 'select', 'boolean']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export class JournalSchemaError extends Error {
  constructor(message = 'Конфигурация выбранного журнала недоступна.') {
    super(message);
    this.name = 'JournalSchemaError';
  }
}

export function validateJournalSchema(value: unknown): JournalColumnDefinition[] {
  if (!Array.isArray(value) || value.length === 0) throw new JournalSchemaError();
  const keys = new Set<string>();
  const columns = value.map((raw): JournalColumnDefinition => {
    if (!isRecord(raw)) throw new JournalSchemaError();
    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const type = raw.type as JournalFieldType;
    if (!key || !title || !supportedTypes.has(type) || typeof raw.required !== 'boolean' || keys.has(key)) throw new JournalSchemaError();
    keys.add(key);
    const options = raw.options;
    if (type === 'select' && (!Array.isArray(options) || options.some((option) => !isRecord(option) || typeof option.value !== 'string' || typeof option.label !== 'string'))) throw new JournalSchemaError();
    for (const constraint of ['min', 'max', 'step'] as const) if (raw[constraint] !== undefined && typeof raw[constraint] !== 'number') throw new JournalSchemaError();
    return {
      key, title, type, required: raw.required,
      placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : undefined,
      helperText: typeof raw.helperText === 'string' ? raw.helperText : undefined,
      options: Array.isArray(options) ? options.map((option) => ({ value: String((option as Record<string, unknown>).value), label: String((option as Record<string, unknown>).label) })) : undefined,
      min: typeof raw.min === 'number' ? raw.min : undefined,
      max: typeof raw.max === 'number' ? raw.max : undefined,
      step: typeof raw.step === 'number' ? raw.step : undefined,
    };
  });
  return columns;
}

export type JournalValidationErrors = Record<string, string>;

export function validateJournalForm(values: LabJournalFormValues, columns: JournalColumnDefinition[]): JournalValidationErrors {
  const errors: JournalValidationErrors = {};
  if (!values.journalType) errors.journalType = 'Выберите вид журнала';
  if (!values.laboratoryId) errors.laboratoryId = 'Выберите лабораторию';
  if (!values.entryDate) errors.entryDate = 'Укажите дату записи';
  if (values.journalType === JournalType.SAMPLE_REGISTRATION && !values.registrationDate) errors.registrationDate = 'Укажите дату регистрации';
  if (values.journalType === JournalType.SOLUTION_PREPARATION && !values.preparationDate) errors.preparationDate = 'Укажите дату приготовления';
  columns.forEach((column) => {
    const value = values.dynamicFields[column.key];
    const path = `dynamicFields.${column.key}`;
    if (column.required && (value === undefined || value === null || value === '')) errors[path] = `Заполните поле «${column.title}»`;
    if (column.type === 'number' && value !== undefined && value !== null && value !== '') {
      const numeric = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(numeric)) errors[path] = 'Введите число';
      else if (column.min !== undefined && numeric < column.min) errors[path] = `Минимальное значение: ${column.min}`;
      else if (column.max !== undefined && numeric > column.max) errors[path] = `Максимальное значение: ${column.max}`;
    }
  });
  if (values.journalType === JournalType.CHEMICAL_REAGENT_USAGE) {
    const initial = Number(values.dynamicFields.initialQuantity || 0);
    const used = Number(values.dynamicFields.usedQuantity || 0);
    if (used < 0) errors['dynamicFields.usedQuantity'] = 'Расход не может быть отрицательным';
    else if (Number.isFinite(initial) && Number.isFinite(used) && used > initial) errors['dynamicFields.usedQuantity'] = 'Расход не может превышать начальное количество';
  }
  return errors;
}
