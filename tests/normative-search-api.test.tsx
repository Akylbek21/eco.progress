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
  searchNormatives,
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearNormativeSearchCache();
});
afterAll(() => server.close());

const renderSelector = (onAdd = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NormativeSelectorModal
        open
        templateId="water_wastewater"
        onClose={vi.fn()}
        onAdd={onAdd}
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

  it('reads data.records and keeps fallback filters canonical', async () => {
    let fallbackUrl: URL | undefined;
    server.use(
      http.get('*/api/normatives/search', () =>
        HttpResponse.json({ data: { items: [], totalElements: 0 } }),
      ),
      http.get('*/api/normatives/records', ({ request }) => {
        fallbackUrl = new URL(request.url);
        return HttpResponse.json({
          data: {
            records: [nickel],
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
        query: 'нике',
        templateId: 'water',
        sourceDocumentCode: 'DSM_138',
        page: 0,
        size: 50,
      },
      undefined,
      { bypassCache: true },
    );

    expect(fallbackUrl?.searchParams.get('query')).toBe('нике');
    expect(fallbackUrl?.searchParams.get('templateId')).toBe('water');
    expect(fallbackUrl?.searchParams.get('sourceDocumentCode')).toBe('DSM_138');
    for (const forbidden of ['search', 'q', 'code', 'pollutantCode']) {
      expect(fallbackUrl?.searchParams.has(forbidden)).toBe(false);
    }
    expect(result.items[0]?.indicatorName).toBe('Никель');
    expect(extractNormativeItems({ data: { data: { records: [nickel] } } })).toEqual([
      nickel,
    ]);
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

    fireEvent.change(input, { target: { value: 'ни' } });
    expect(
      await screen.findByText(/Введите не менее 3 символов/, {}, { timeout: 1_500 }),
    ).toBeTruthy();
    expect(requestCount).toBe(0);

    fireEvent.change(input, { target: { value: 'ошибка' } });
    expect(
      await screen.findByText(
        'Не удалось выполнить поиск нормативных показателей.',
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
});
