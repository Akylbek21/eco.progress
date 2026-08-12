// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import NormativeSelectorModal from '../src/features/protocols/components/components/NormativeSelectorModal';
import {
  clearNormativeSearchCache,
  extractNormativeItems,
  formatNormativeSearchError,
  searchNormatives,
  searchNormativesStaged,
} from '../src/services/normativeSearchService';

const server = setupServer();

const nickel = {
  id: 143,
  indicatorName: 'Никель',
  pollutantCode: '0143',
  unit: 'мг/дм³',
  normativeValue: 0.1,
  sourceDocumentCode: 'DSM_138',
};

const protocolSearchCases = [
  { wizardType: 'ambient_air', templateId: 'ambient_air', sourceDocumentCode: 'DSM_70', environmentType: 'ATMOSPHERIC_AIR' },
  { wizardType: 'workplace_air', templateId: 'workplace_air', sourceDocumentCode: 'DSM_70', environmentType: 'WORKPLACE_AIR' },
  { wizardType: 'soil', templateId: 'soil', sourceDocumentCode: 'DSM_32' },
  { wizardType: 'water', templateId: 'water', sourceDocumentCode: 'DSM_138' },
  { wizardType: 'microclimate', templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'MICROCLIMATE' },
  { wizardType: 'lighting', templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'LIGHTING' },
  { wizardType: 'noise_vibration', templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'NOISE' },
  { wizardType: 'uv_emf_laser', templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'UV' },
] as const;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearNormativeSearchCache();
});
afterAll(() => server.close());

const renderSelector = (
  onAdd = vi.fn(),
  templateId: React.ComponentProps<typeof NormativeSelectorModal>['templateId'] = 'water',
  filters: React.ComponentProps<typeof NormativeSelectorModal>['filters'] = {},
  onSuggestChangeType = vi.fn(),
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NormativeSelectorModal
        open
        templateId={templateId}
        filters={filters}
        onClose={vi.fn()}
        onAdd={onAdd}
        onManual={vi.fn()}
        onSuggestChangeType={onSuggestChangeType}
      />
    </QueryClientProvider>,
  );
  return { onAdd, queryClient };
};

describe('normative search HTTP contract', () => {
  it('sends partial name only as query and preserves templateId', async () => {
    let actualUrl: URL | undefined;
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json({
          data: {
            items: [nickel],
            page: 0,
            size: 50,
            totalElements: 1,
            totalPages: 1,
          },
        });
      }),
    );

    const result = await searchNormatives(
      {
        query: '  нике  ',
        templateId: 'water',
        page: 0,
        size: 50,
        status: 'ACTIVE',
      },
      undefined,
      { bypassCache: true },
    );

    expect(actualUrl?.searchParams.get('query')).toBe('нике');
    expect(actualUrl?.searchParams.get('templateId')).toBe('water');
    expect(actualUrl?.searchParams.get('page')).toBe('0');
    expect(actualUrl?.searchParams.get('size')).toBe('50');
    expect(actualUrl?.searchParams.get('status')).toBe('ACTIVE');
    for (const forbidden of ['search', 'q', 'code', 'pollutantCode', 'indicator']) {
      expect(actualUrl?.searchParams.has(forbidden)).toBe(false);
    }
    expect(result.items[0]?.indicatorName).toBe('Никель');
  });

  it('sends an explicitly provided pollutantCode as an exact filter', async () => {
    let actualUrl: URL | undefined;
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json({ data: { items: [nickel] } });
      }),
    );

    await searchNormatives(
      { pollutantCode: '0143', templateId: 'water', page: 0, size: 50 },
      undefined,
      { bypassCache: true },
    );

    expect(actualUrl?.searchParams.get('pollutantCode')).toBe('0143');
    expect(actualUrl?.searchParams.has('query')).toBe(false);
  });

  it('stops after one STRICT_ACTIVE request when a normative exists', async () => {
    const requests: URL[] = [];
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: { items: [nickel] } });
    }));

    const result = await searchNormativesStaged({ query: 'нике', templateId: 'water', sourceDocumentCode: 'DSM_138' });

    expect(requests).toHaveLength(1);
    expect(result.fallbackStage).toBe('STRICT_ACTIVE');
    expect(result.relaxed).toBe(false);
  });

  it('falls back from ACTIVE to ALL and preserves a REVIEW status', async () => {
    const statuses: string[] = [];
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status') || '';
        statuses.push(status);
        return HttpResponse.json({ data: { items: status === 'ALL' ? [{ ...nickel, status: 'REVIEW' }] : [] } });
      }),
    );

    const result = await searchNormativesStaged({ query: 'нике', templateId: 'water', sourceDocumentCode: 'DSM_138' });

    expect(statuses).toEqual(['ACTIVE', 'ALL']);
    expect(result.items[0]?.indicatorName).toBe('Никель');
    expect(result.items[0]?.status).toBe('REVIEW');
    expect(result.fallbackStage).toBe('STRICT_ALL');
  });

  it('relaxes water conditions but always keeps template and DSM_138', async () => {
    const requests: URL[] = [];
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const relaxed = !url.searchParams.has('waterType') && !url.searchParams.has('waterUseCategory');
      return HttpResponse.json({ data: { items: relaxed && url.searchParams.get('status') === 'ACTIVE' ? [nickel] : [] } });
    }));

    const result = await searchNormativesStaged({
      query: 'нике', templateId: 'water', sourceDocumentCode: 'DSM_138',
      waterType: 'DRINKING', waterUseCategory: 'DOMESTIC',
    });

    expect(requests.map((url) => url.searchParams.get('status'))).toEqual(['ACTIVE', 'ALL', 'ACTIVE']);
    expect(requests.every((url) => url.searchParams.get('templateId') === 'water')).toBe(true);
    expect(requests.every((url) => url.searchParams.get('sourceDocumentCode') === 'DSM_138')).toBe(true);
    expect(requests[0]?.searchParams.get('waterType')).toBe('DRINKING');
    expect(requests[2]?.searchParams.has('waterType')).toBe(false);
    expect(result.fallbackStage).toBe('RELAXED_ACTIVE');
    expect(result.items[0]?.matchQuality).toBe('CONTEXT_GENERAL');
  });

  it.each(['10102-44-0', 'NO2'])('keeps %s as a free-text CAS or formula query', async (value) => {
    let actualUrl: URL | undefined;
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      actualUrl = new URL(request.url);
      return HttpResponse.json({ data: { items: [nickel] } });
    }));
    await searchNormativesStaged({ query: value, templateId: 'ambient_air', sourceDocumentCode: 'DSM_70' });
    expect(actualUrl?.searchParams.get('query')).toBe(value);
    expect(actualUrl?.searchParams.has('code')).toBe(false);
  });

  it.each(protocolSearchCases.flatMap((protocol) => [
    { ...protocol, searchField: 'code' as const, searchValue: '2322' },
    { ...protocol, searchField: 'query' as const, searchValue: 'Никель' },
  ]))('searches $wizardType by $searchField without dropping its protocol filters', async ({
    templateId, sourceDocumentCode, environmentType, factorType, searchField, searchValue,
  }) => {
    let actualUrl: URL | undefined;
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      actualUrl = new URL(request.url);
      const filtersApplied = {
        code: actualUrl.searchParams.get('code'),
        query: actualUrl.searchParams.get('query'),
        templateId: actualUrl.searchParams.get('templateId'),
        sourceDocumentCode: actualUrl.searchParams.get('sourceDocumentCode'),
      };
      return HttpResponse.json({ data: { items: [{
        ...nickel,
        id: `${templateId}-${searchField}`,
        code: '2322',
        pollutantCode: '2322',
        indicatorName: 'Никель',
        templateId,
        sourceDocumentCode,
        environmentType,
        factorType,
      }], filtersApplied } });
    }));

    const result = await searchNormativesStaged({
      [searchField]: searchValue,
      templateId,
      sourceDocumentCode,
      environmentType,
      factorType,
    });

    expect(result.items).toHaveLength(1);
    expect(actualUrl?.searchParams.get(searchField)).toBe(searchValue);
    expect(actualUrl?.searchParams.get('templateId')).toBe(templateId);
    expect(actualUrl?.searchParams.get('sourceDocumentCode')).toBe(sourceDocumentCode);
    expect(result.filtersApplied).toEqual({
      code: searchField === 'code' ? searchValue : null,
      query: searchField === 'query' ? searchValue : null,
      templateId,
      sourceDocumentCode,
    });
  });

  it('keeps the real HTTP status and backend code in a search error', async () => {
    server.use(http.get('*/api/normatives/search', () => HttpResponse.json({
      code: 'ACCESS_DENIED',
      message: 'Нет прав на поиск норматив',
    }, { status: 403 })));

    let message = '';
    try {
      await searchNormativesStaged({ query: 'Никель', templateId: 'water' });
    } catch (error) {
      message = formatNormativeSearchError(error);
    }

    expect(message).toContain('HTTP 403');
    expect(message).toContain('ACCESS_DENIED');
    expect(message).toContain('Нет прав на поиск норматив');
  });
});

describe('normative selector modal', () => {
  it('waits for debounce and displays a partial-name result without an empty flash', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        requestCount += 1;
        expect(new URL(request.url).searchParams.get('query')).toBe('нике');
        return HttpResponse.json({ data: { items: [nickel] } });
      }),
    );
    renderSelector();

    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), {
      target: { value: 'нике' },
    });

    expect(requestCount).toBe(0);
    expect(screen.queryByText(/ничего не найдено/)).toBeNull();
    expect(screen.getByText('Подготавливаем поиск…')).toBeTruthy();
    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    expect(requestCount).toBe(1);
  });

  it('uses an exact code filter for numeric pollutant codes', async () => {
    let actualUrl: URL | undefined;
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      actualUrl = new URL(request.url);
      return HttpResponse.json({ data: { items: [{
        ...nickel,
        id: 1233,
        pollutantCode: '1233',
        templateId: 'ambient_air',
        sourceDocumentCode: 'DSM_70',
        environmentType: 'ATMOSPHERIC_AIR',
      }] } });
    }));
    renderSelector(vi.fn(), 'ambient_air');

    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), { target: { value: '1233' } });

    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    expect(actualUrl?.searchParams.get('code')).toBe('1233');
    expect(actualUrl?.searchParams.has('query')).toBe(false);
    expect(actualUrl?.searchParams.get('templateId')).toBe('ambient_air');
    expect(actualUrl?.searchParams.get('sourceDocumentCode')).toBe('DSM_70');
    expect(actualUrl?.searchParams.get('environmentType')).toBe('ATMOSPHERIC_AIR');
  });

  it('shows a water normative found after relaxing additional conditions', async () => {
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const relaxed = !params.has('waterType') && !params.has('waterUseCategory');
      return HttpResponse.json({ data: { items: relaxed && params.get('status') === 'ACTIVE' ? [nickel] : [] } });
    }));
    renderSelector(vi.fn(), 'water', { waterType: 'DRINKING', waterUseCategory: 'DOMESTIC' });

    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), { target: { value: 'нике' } });

    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    expect(screen.getByText('Норматив найден по типу протокола. Дополнительные условия не совпали — проверьте применимость.')).toBeTruthy();
    expect(screen.getByText('Общий норматив')).toBeTruthy();
  });

  it('shows REVIEW records from the ALL stage with a warning', async () => {
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      return HttpResponse.json({ data: { items: status === 'ALL' ? [{ ...nickel, status: 'REVIEW' }] : [] } });
    }));
    renderSelector();

    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), { target: { value: 'нике' } });

    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    expect(screen.getByText('Требуется проверка')).toBeTruthy();
    expect(screen.getByText(/Показаны нормативы всех статусов/)).toBeTruthy();
  });

  it('never crosses from soil into ambient-air normatives', async () => {
    const requestedTemplates: string[] = [];
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      const template = new URL(request.url).searchParams.get('templateId') || '';
      requestedTemplates.push(template);
      return HttpResponse.json({ data: { items: template === 'ambient_air' ? [nickel] : [] } });
    }));
    renderSelector(vi.fn(), 'soil');

    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), { target: { value: 'нике' } });

    expect(await screen.findByText('Норматив не найден в справочнике для данного типа протокола. Можно добавить показатель вручную.', {}, { timeout: 2_500 })).toBeTruthy();
    expect(requestedTemplates.length).toBeGreaterThan(0);
    expect(requestedTemplates.slice(0, -1).every((template) => template === 'soil')).toBe(true);
    expect(requestedTemplates.at(-1)).toBe('');
    expect(screen.queryByText('Никель')).toBeNull();
  });

  it('explains an incompatible code and offers to change the protocol type', async () => {
    const onSuggestChangeType = vi.fn();
    server.use(http.get('*/api/normatives/search', ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json({ data: { items: !url.searchParams.has('templateId') ? [{
        ...nickel,
        id: 2322,
        code: '2322',
        pollutantCode: '2322',
        templateId: 'workplace_air',
        sourceDocumentCode: 'DSM_70',
        environmentType: 'WORKPLACE_AIR',
      }] : [] } });
    }));
    renderSelector(vi.fn(), 'soil', {}, onSuggestChangeType);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '2322' } });

    expect(await screen.findByText('Код 2322 относится к “Воздуху рабочей зоны” и недоступен для протокола “Почва”.', {}, { timeout: 2_500 })).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сменить тип протокола на “Воздух рабочей зоны”' }));
    expect(onSuggestChangeType).toHaveBeenCalledWith('workplace_air');
  });

  it('does not search short text and exposes an API retry action', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/api/normatives/search', () => {
        requestCount += 1;
        return HttpResponse.json({ message: 'failure' }, { status: 500 });
      }),
    );
    renderSelector();
    const input = screen.getByLabelText('Поиск нормативных показателей');

    fireEvent.change(input, { target: { value: 'н' } });
    expect(
      await screen.findByText(/Введите не менее 2 символов/, {}, { timeout: 1_500 }),
    ).toBeTruthy();
    expect(requestCount).toBe(0);

    fireEvent.change(input, { target: { value: 'ошибка' } });
    expect(
      await screen.findByText(
        'Поиск нормативов временно недоступен. Добавьте показатель вручную или повторите поиск.',
        {},
        { timeout: 2_500 },
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Повторить поиск' })).toBeTruthy();
  });

  it('keeps selected records after a different search', async () => {
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        const query = new URL(request.url).searchParams.get('query');
        const item =
          query === 'медь'
            ? { ...nickel, id: 144, indicatorName: 'Медь', pollutantCode: '0144' }
            : nickel;
        return HttpResponse.json({ data: { items: [item] } });
      }),
    );
    const onAdd = vi.fn();
    renderSelector(onAdd);
    const input = screen.getByLabelText('Поиск нормативных показателей');

    fireEvent.change(input, { target: { value: 'нике' } });
    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(
      screen.getByRole('button', { name: 'Добавить выбранные (1)' }),
    ).toBeTruthy();

    fireEvent.change(input, { target: { value: 'медь' } });
    expect(await screen.findByText('Медь', {}, { timeout: 2_500 })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Добавить выбранные (1)' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить выбранные (1)' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0]?.[0]?.[0]?.indicatorName).toBe('Никель');
  });

  it('aborts the stale request and does not overwrite the latest result', async () => {
    let markFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    server.use(
      http.get('*/api/normatives/search', async ({ request }) => {
        const query = new URL(request.url).searchParams.get('query');
        if (query === 'ник') {
          markFirstStarted?.();
          await delay(1_000);
          return HttpResponse.json({
            data: { items: [{ ...nickel, indicatorName: 'Устаревший результат' }] },
          });
        }
        return HttpResponse.json({
          data: { items: [{ ...nickel, indicatorName: 'Никель актуальный' }] },
        });
      }),
    );
    renderSelector();
    const input = screen.getByLabelText('Поиск нормативных показателей');

    fireEvent.change(input, { target: { value: 'ник' } });
    await firstStarted;
    fireEvent.change(input, { target: { value: 'нике' } });

    expect(
      await screen.findByText('Никель актуальный', {}, { timeout: 2_500 }),
    ).toBeTruthy();
    await delay(1_100);
    expect(screen.getByText('Никель актуальный')).toBeTruthy();
    expect(screen.queryByText('Устаревший результат')).toBeNull();
  });

  it('requires factorType before searching an ambiguous physical protocol', async () => {
    let requestCount = 0;
    let requestedFactor = '';
    let requestedTemplate = '';
    server.use(
      http.get('*/api/normatives/search', ({ request }) => {
        requestCount += 1;
        const params = new URL(request.url).searchParams;
        requestedFactor = params.get('factorType') || '';
        requestedTemplate = params.get('templateId') || '';
        return HttpResponse.json({ data: { items: [{
          ...nickel,
          templateId: 'physical_factors',
          sourceDocumentCode: 'DSM_15',
          factorType: 'NOISE',
        }] } });
      }),
    );
    renderSelector(vi.fn(), 'noise_vibration');
    fireEvent.change(screen.getByLabelText('Поиск нормативных показателей'), { target: { value: 'шум' } });
    expect(await screen.findByText('Сначала выберите вид физического фактора.', {}, { timeout: 1_500 })).toBeTruthy();
    expect(requestCount).toBe(0);

    fireEvent.change(screen.getByLabelText('Вид физического фактора'), { target: { value: 'NOISE' } });

    expect(await screen.findByText('Никель', {}, { timeout: 2_500 })).toBeTruthy();
    expect(requestCount).toBe(1);
    expect(requestedFactor).toBe('NOISE');
    expect(requestedTemplate).toBe('physical_factors');
  });
});
