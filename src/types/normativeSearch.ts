export interface NormativeSearchItem {
  id: number | string;
  code?: string | null;
  pollutantCode?: string | null;
  indicatorName: string;
  shortName?: string | null;
  casNumber?: string | null;
  formula?: string | null;

  unit?: string | null;
  limitValue?: number | null;
  limitMin?: number | null;
  limitMax?: number | null;
  comparisonType?:
    | 'LESS_OR_EQUAL'
    | 'GREATER_OR_EQUAL'
    | 'RANGE'
    | 'EQUAL'
    | string;

  templateId?: string | null;
  sourceDocumentCode?: string | null;
  sourceDocumentName?: string | null;
  environmentType?: string | null;

  factorType?: string | null;
  factorCode?: string | null;

  waterType?: string | null;
  waterUseCategory?: string | null;
  categoryCode?: string | null;

  roomType?: string | null;
  season?: string | null;
  workCategory?: string | null;
  workplaceType?: string | null;
  normLevel?: string | null;

  visualWorkCategory?: string | null;
  lightingType?: string | null;
  noiseType?: string | null;

  conditionJson?: Record<string, unknown> | null;
  status?: 'ACTIVE' | 'REVIEW' | string;
  relevanceScore?: number;
}

export interface NormativeSearchResponse {
  success: boolean;
  data: {
    items: NormativeSearchItem[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  message?: string | null;
  errors?: string[];
}

export interface NormativeSearchParams {
  query: string;

  templateId?: string;
  sourceDocumentCode?: string;
  environmentType?: string;

  factorType?: string;
  factorCode?: string;

  waterType?: string;
  waterUseCategory?: string;
  categoryCode?: string;

  roomType?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  normLevel?: string;

  visualWorkCategory?: string;
  lightingType?: string;
  noiseType?: string;

  unit?: string;
  status?: 'ACTIVE' | 'REVIEW' | 'ALL';

  page?: number;
  size?: number;
}
