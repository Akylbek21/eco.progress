import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveProtocolNormativeContext } from '../data/protocolNormativeContext';
import { getApiErrorMessage } from '../services/apiHelpers';
import {
  canSearchNormative,
  cleanNormativeSearchParams,
  isNormativeSearchCanceled,
  NORMATIVE_SEARCH_DEBOUNCE_MS,
  searchNormatives,
} from '../services/normativeSearchService';
import type { NormativeSearchItem, NormativeSearchParams } from '../types/normativeSearch';

export interface UseNormativeSearchOptions {
  protocolType?: string;
  query?: string | null;
  filters?: Partial<NormativeSearchParams>;
  enabled?: boolean;
}

export interface UseNormativeSearchResult {
  items: NormativeSearchItem[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  totalElements: number;
  search: () => Promise<void>;
  reset: () => void;
}

export const useNormativeSearch = ({
  protocolType,
  query = '',
  filters = {},
  enabled = true,
}: UseNormativeSearchOptions): UseNormativeSearchResult => {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const filtersKey = JSON.stringify(cleanNormativeSearchParams(filters));
  const params = useMemo(() => {
    const context = resolveProtocolNormativeContext(protocolType, filters.factorType);
    const cleanedFilters = cleanNormativeSearchParams(filters);
    return {
      ...context,
      ...cleanedFilters,
      query: normalizedQuery,
      status: filters.status ?? 'ACTIVE',
      page: 0,
      size: 30,
    } satisfies NormativeSearchParams;
  }, [protocolType, normalizedQuery, filtersKey]);
  const contextKey = useMemo(() => JSON.stringify({
    ...params,
    query: undefined,
  }), [params]);

  const [items, setItems] = useState<NormativeSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  const reset = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setItems([]);
    setLoading(false);
    setError(null);
    setHasSearched(false);
    setTotalElements(0);
  }, []);

  const execute = useCallback(async (bypassCache = false) => {
    if (!enabled || !canSearchNormative(params.query)) {
      reset();
      return;
    }
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await searchNormatives(params, controller.signal, { bypassCache });
      if (controller.signal.aborted || sequence !== sequenceRef.current) return;
      setItems(result.items);
      setTotalElements(result.totalElements);
      setHasSearched(true);
    } catch (requestError) {
      if (controller.signal.aborted || sequence !== sequenceRef.current || isNormativeSearchCanceled(requestError)) return;
      setItems([]);
      setTotalElements(0);
      setHasSearched(true);
      setError(getApiErrorMessage(requestError, 'Не удалось загрузить нормативы'));
    } finally {
      if (sequence === sequenceRef.current) setLoading(false);
    }
  }, [enabled, params, reset]);

  useEffect(() => {
    reset();
  }, [contextKey, reset]);

  useEffect(() => {
    if (!enabled || !canSearchNormative(params.query)) {
      reset();
      return;
    }
    const timer = window.setTimeout(() => void execute(), NORMATIVE_SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [enabled, execute, params.query, reset]);

  useEffect(() => () => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
  }, []);

  return {
    items,
    loading,
    error,
    hasSearched,
    totalElements,
    search: useCallback(() => execute(true), [execute]),
    reset,
  };
};
