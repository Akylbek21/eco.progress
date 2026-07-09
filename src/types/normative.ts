import type { NormativeRecord } from './protocols';

export type {
  NormativeComparisonType,
  NormativeRecord,
  NormativeSearchResult,
} from './protocols';

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
