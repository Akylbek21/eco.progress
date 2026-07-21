import type { NormativeRecord as LegacyNormativeRecord } from './protocols';

export type NormativeValueType = 'EXACT' | 'LE' | 'LT' | 'GE' | 'GT' | 'RANGE' | 'TEXT' | 'REFERENCE_ONLY';

export interface NormativeRecord {
  id: number;
  documentCode: string;
  documentTitle?: string;
  documentVersion?: string;
  category: string;
  subCategory?: string;
  tableNumber?: string;
  indicatorCode?: string;
  indicatorName: string;
  pollutantCode?: string;
  cas?: string;
  formula?: string;
  unit?: string;
  valueType: NormativeValueType;
  value?: number;
  minValue?: number;
  maxValue?: number;
  valueRaw?: string;
  protocolType?: string;
  subtype?: string;
  conditions?: Record<string, unknown>;
  active: boolean;
  archived: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  totalElementsExact?: boolean;
}

export type NormativeReplaceMode = 'INSERT_ONLY' | 'UPSERT' | 'REPLACE_DOCUMENT';
export type NormativePreviewRowStatus = 'NEW' | 'UPDATE' | 'DUPLICATE' | 'CONFLICT' | 'ERROR';

export interface NormativeImportPreviewRow {
  rowNumber: number;
  status: NormativePreviewRowStatus;
  indicatorCode?: string;
  indicatorName: string;
  unit?: string;
  valueRaw?: string;
  recognizedValue?: string;
  documentCode?: string;
  message?: string;
}

export interface NormativeImportSession {
  importId: string;
  fileName: string;
  documentCode: string;
  replaceMode: NormativeReplaceMode;
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  created: number;
  updated: number;
  duplicates: number;
  conflicts: number;
  rows: NormativeImportPreviewRow[];
}

export type {
  NormativeComparisonType,
  NormativeSearchResult,
} from './protocols';

/** @deprecated Transitional backend DTO. New directory code uses NormativeRecord above. */
export type LegacyNormativeDto = LegacyNormativeRecord;

export type NormativeSearchParams = {
  query?: string;
  search?: string;
  sourceDocumentCode?: string;
  templateId?: string;
  category?: string;
  categoryCode?: string;
  subtype?: string;
  factorType?: string;
  pollutantCode?: string;
  page?: number;
  size?: number;
};

export type NormativeImportPreview = {
  items: NormativeRecord[];
  total: number;
  valid: number;
  invalid: number;
  created?: number;
  updated?: number;
  errors: Array<{ row?: number; message: string }>;
  importId?: string;
  importBatchId?: string;
  fileName?: string;
};

export type NormativeImportConfirm = {
  importId?: string;
  importBatchId?: string;
};

export type Dsm138ImportPreview = NormativeImportPreview;
