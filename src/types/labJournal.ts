export const JOURNAL_SCHEMA_VERSION = 2;

export const JournalType = {
  SAMPLE_REGISTRATION: 'SAMPLE_REGISTRATION',
  SOLUTION_PREPARATION: 'SOLUTION_PREPARATION',
  CHEMICAL_REAGENT_USAGE: 'CHEMICAL_REAGENT_USAGE',
  ENVIRONMENT_CONDITIONS: 'ENVIRONMENT_CONDITIONS',
  TEST_RESULTS_REGISTRATION: 'TEST_RESULTS_REGISTRATION',
} as const;

export type LabJournalType = typeof JournalType[keyof typeof JournalType];
/** @deprecated Use LabJournalType. */
export type JournalType = LabJournalType;

export const LAB_JOURNAL_TYPES: Record<LabJournalType, { label: string; description: string }> = {
  SAMPLE_REGISTRATION: {
    label: 'Журнал регистрации образцов',
    description: 'Регистрация поступивших проб и образцов',
  },
  SOLUTION_PREPARATION: {
    label: 'Журнал приготовления растворов',
    description: 'Приготовление, использование и срок годности растворов',
  },
  CHEMICAL_REAGENT_USAGE: {
    label: 'Журнал использования реактивов',
    description: 'Учёт поступления и расходования химических реактивов',
  },
  ENVIRONMENT_CONDITIONS: {
    label: 'Журнал условий окружающей среды',
    description: 'Температура, влажность, давление и другие условия',
  },
  TEST_RESULTS_REGISTRATION: {
    label: 'Журнал регистрации результатов испытаний',
    description: 'Регистрация выполненных лабораторных испытаний',
  },
};

export type JournalFieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'boolean';

export interface JournalColumnDefinition {
  key: string;
  title: string;
  type: JournalFieldType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export interface LabJournalTypeDto {
  code: LabJournalType;
  name: string;
  description?: string;
  columns?: JournalColumnDefinition[];
}

export interface JournalTypeDefinition {
  code: LabJournalType;
  name: string;
  description?: string;
  columns: JournalColumnDefinition[];
  schemaSource: 'backend' | 'local';
}

export interface LabJournalEntry {
  id: number;
  version?: number;
  journalType: LabJournalType;
  laboratoryId: number;
  laboratoryName?: string;
  entryDate: string;
  registrationDate?: string | null;
  preparationDate?: string | null;
  executorName?: string | null;
  note?: string | null;
  data: Record<string, unknown>;
  fields: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface LabJournalFormValues {
  id?: number;
  version?: number;
  journalType: LabJournalType | '';
  laboratoryId: number | null;
  entryDate: string;
  registrationDate: string;
  preparationDate: string;
  executorName: string;
  note: string;
  dynamicFields: Record<string, unknown>;
}

export interface CreateLabJournalEntryRequest {
  journalType: LabJournalType;
  laboratoryId: number;
  entryDate: string;
  registrationDate?: string | null;
  preparationDate?: string | null;
  executorName?: string | null;
  note?: string | null;
  data: Record<string, unknown>;
  fields: Record<string, unknown>;
}

export interface UpdateLabJournalEntryRequest extends CreateLabJournalEntryRequest {
  version?: number;
}

export interface JournalEntriesQuery {
  journalType?: LabJournalType;
  laboratoryId?: number;
  dateFrom?: string;
  dateTo?: string;
  executorName?: string;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ExportJournalParams extends Omit<JournalEntriesQuery, 'page' | 'size'> {}

export type JournalTypesResult = { content: JournalTypeDefinition[]; schemaSource: 'backend' | 'local' };
export type JournalEntry = LabJournalEntry;
export type JournalColumn = JournalColumnDefinition;
export type JournalColumnType = JournalFieldType;
export type JournalValues = Record<string, unknown>;
export type JournalValue = string | number | boolean | null;
export type JournalEntriesParams = JournalEntriesQuery;
export type JournalEntryPayload = UpdateLabJournalEntryRequest;
export type LabJournalEntryData = Record<string, unknown>;
export type LabJournalValue = JournalValue;
export type LabJournalPage = PageResponse<LabJournalEntry>;
export type LabJournalQuery = JournalEntriesQuery;
export type SaveLabJournalEntryPayload = UpdateLabJournalEntryRequest;
