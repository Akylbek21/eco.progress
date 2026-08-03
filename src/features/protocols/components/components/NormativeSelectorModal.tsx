import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import { resolveProtocolNormativeContext } from '../../../../data/protocolNormativeContext';
import {
  canSearchNormative,
  normativeSearchItemToRecord,
  searchNormatives,
  type NormativeSearchRequest,
} from '../../../../services/normativeSearchService';
import type { NormativeRecord, ProtocolTemplateId } from '../../../../types/protocols';

type Props = {
  open: boolean;
  templateId: ProtocolTemplateId | '';
  filters?: NormativeSearchRequest;
  onClose: () => void;
  onAdd: (items: NormativeRecord[]) => void;
  onManual: () => void;
};

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_PAGE_SIZE = 50;

const NormativeSelectorModal = ({
  open,
  templateId,
  filters = {},
  onClose,
  onAdd,
  onManual,
}: Props) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<
    Map<string, NormativeRecord>
  >(new Map());
  const normalizedSearch = search.trim();
  const waitingForDebounce = normalizedSearch !== debouncedSearch;

  useEffect(() => {
    void queryClient.cancelQueries({
      queryKey: ['protocol-normative-search-v2'],
    });
    if (!normalizedSearch) {
      setDebouncedSearch('');
      return;
    }
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(normalizedSearch),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [normalizedSearch, queryClient]);

  const searchContext = useMemo(
    () => resolveProtocolNormativeContext(templateId),
    [templateId],
  );
  const request = useMemo<NormativeSearchRequest>(
    () => ({
      ...searchContext,
      ...filters,
      query: debouncedSearch || undefined,
      page: 0,
      size: SEARCH_PAGE_SIZE,
      status: 'ACTIVE',
    }),
    [debouncedSearch, filters, searchContext],
  );
  const searchAllowed = canSearchNormative(debouncedSearch);
  const query = useQuery({
    queryKey: [
      'protocol-normative-search-v2',
      request.query,
      request.templateId,
      request.sourceDocumentCode,
      request.waterType,
      request.waterUseCategory,
      request.factorType,
      request.categoryCode,
      request.lightingType,
      request.noiseType,
      request.roomType,
      request.season,
      request.workCategory,
      request.workplaceType,
      request.page,
      request.size,
      request.status,
    ],
    enabled:
      open &&
      Boolean(templateId) &&
      searchAllowed &&
      !waitingForDebounce,
    queryFn: ({ signal }) => searchNormatives(request, signal),
    retry: false,
    placeholderData: (previousData) => previousData,
    staleTime: (cachedQuery) =>
      cachedQuery.state.data?.items.length ? 30_000 : 2_000,
    gcTime: 5 * 60_000,
  });
  const rows = useMemo(
    () => (query.data?.items ?? []).map(normativeSearchItemToRecord),
    [query.data?.items],
  );

  const close = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedRecords(new Map());
    onClose();
  };

  const addSelected = () => {
    onAdd(Array.from(selectedRecords.values()));
    setSelectedRecords(new Map());
  };

  const toggleRecord = (record: NormativeRecord, checked: boolean) => {
    const id = String(record.id);
    setSelectedRecords((current) => {
      const next = new Map(current);
      if (checked) next.set(id, record);
      else next.delete(id);
      return next;
    });
  };

  const currentQueryFinished =
    !waitingForDebounce &&
    searchAllowed &&
    query.isSuccess &&
    !query.isFetching;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Выбор нормативных показателей"
      closeOnBackdrop={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>
            Отмена
          </Button>
          <Button type="button" variant="secondary" onClick={onManual}>
            Добавить показатель вручную
          </Button>
          <Button
            type="button"
            disabled={!selectedRecords.size}
            onClick={addSelected}
          >
            Добавить выбранные ({selectedRecords.size})
          </Button>
        </>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Введите название показателя, код, формулу или CAS"
          aria-label="Поиск нормативных показателей"
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-eco-500 focus:ring-2 focus:ring-eco-100"
        />
      </div>

      <div
        className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto"
        aria-live="polite"
      >
        {!normalizedSearch && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Введите название, код, CAS или формулу показателя.
          </p>
        )}

        {normalizedSearch &&
          !canSearchNormative(normalizedSearch) &&
          !waitingForDebounce && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Введите не менее 2 символов для текстового поиска. Код можно искать
              с первого символа; также поддерживаются название, CAS или
              формуле.
            </p>
          )}

        {waitingForDebounce && normalizedSearch && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Подготавливаем поиск…
          </p>
        )}

        {!waitingForDebounce && query.isFetching && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Поиск нормативных показателей…
          </p>
        )}

        {currentQueryFinished && rows.length === 0 && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            По запросу «{debouncedSearch}» ничего не найдено в выбранном типе
            протокола.
          </p>
        )}

        {currentQueryFinished && Boolean(query.data?.relaxed) && rows.length > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Показатель найден, но применимый норматив необходимо проверить.
          </p>
        )}

        {!waitingForDebounce && query.isError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            <p className="font-semibold">
              Поиск нормативов временно недоступен. Добавьте показатель вручную или повторите поиск.
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-2 font-bold text-rose-800 underline underline-offset-2"
            >
              Повторить поиск
            </button>
          </div>
        )}

        {currentQueryFinished &&
          rows.map((item) => {
            const id = String(item.id);
            return (
              <label
                key={id}
                className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-eco-300 hover:bg-eco-50/40"
              >
                <input
                  type="checkbox"
                  checked={selectedRecords.has(id)}
                  onChange={(event) => toggleRecord(item, event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-eco-700"
                />
                <span className="min-w-0">
                  <strong className="block text-slate-900">
                    {item.indicator ||
                      item.indicatorName ||
                      item.name ||
                      item.code}
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {item.code || item.pollutantCode || 'без кода'} ·{' '}
                    {item.unit || 'без единицы'} ·{' '}
                    {item.value ?? item.normativeValue ?? '—'} ·{' '}
                    {item.normativeDocument ||
                      item.sourceDocumentName ||
                      'источник не указан'}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1 text-xs font-semibold">
                    {item.matchQuality === 'EXACT' && <Badge>Точное совпадение</Badge>}
                    {item.matchQuality === 'CONTEXT_GENERAL' && <Badge>Общий норматив</Badge>}
                    {(item.matchQuality === 'TEMPLATE_DOCUMENT' || item.matchQuality === 'TEMPLATE_ONLY') && <Badge>Совпадение по типу протокола</Badge>}
                    {item.status === 'REVIEW' && <Badge warning>Требуется проверка</Badge>}
                    {item.status === 'INACTIVE' && <Badge warning>Неактивный норматив</Badge>}
                  </span>
                </span>
              </label>
            );
          })}
      </div>
    </Modal>
  );
};

const Badge = ({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) => <span className={`rounded-full px-2 py-0.5 ${warning ? 'bg-amber-100 text-amber-900' : 'bg-eco-100 text-eco-900'}`}>{children}</span>;

export default NormativeSelectorModal;
