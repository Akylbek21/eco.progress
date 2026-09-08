// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import PekCompanyObjectFilters from '../src/features/pek/components/common/PekCompanyObjectFilters';

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, role: 'ADMIN' } }),
}));

const companies = [
  { id: 10, name: 'ТОО «Eco Company»', bin: '123456789012' },
  { id: 20, name: 'ТОО «Second Company»', bin: '210987654321' },
];
const objects = {
  10: [{ id: 101, companyId: 10, name: 'Площадка Север', address: 'Шымкент', status: 'ACTIVE' }],
  20: [{ id: 201, companyId: 20, name: 'Площадка Юг', address: 'Тараз', status: 'ACTIVE' }],
};
let scopeCompanies = companies;
let companyStatus = 200;
const objectRequests: number[] = [];

const server = setupServer(
  http.get('*/api/pek/scope/companies', () => companyStatus === 200
    ? HttpResponse.json({ data: scopeCompanies })
    : HttpResponse.json({ code: 'FORBIDDEN' }, { status: companyStatus })),
  http.get('*/api/pek/scope/companies/:companyId/objects', ({ params }) => {
    const companyId = Number(params.companyId);
    objectRequests.push(companyId);
    return HttpResponse.json({ data: objects[companyId as keyof typeof objects] || [] });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  scopeCompanies = companies;
  companyStatus = 200;
  objectRequests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

const Harness = () => {
  const [companyId, setCompanyId] = useState('');
  const [objectId, setObjectId] = useState('');
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>
    <PekCompanyObjectFilters
      companyId={Number(companyId) || undefined}
      objectId={Number(objectId) || undefined}
      onCompanyChange={setCompanyId}
      onObjectChange={setObjectId}
      required
    />
    <output data-testid="company-id">{companyId}</output>
    <output data-testid="object-id">{objectId}</output>
  </QueryClientProvider>;
};

const UrlHarness = () => {
  const [params, setParams] = useState(() => new URLSearchParams());
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const update = (key: 'companyId' | 'objectId', value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key === 'companyId') next.delete('objectId');
    setParams(next);
  };
  const companyId = Number(params.get('companyId')) || undefined;
  const objectId = Number(params.get('objectId')) || undefined;
  return <QueryClientProvider client={client}>
    <PekCompanyObjectFilters
      companyId={companyId}
      objectId={objectId}
      onCompanyChange={(value) => update('companyId', value)}
      onObjectChange={(value) => update('objectId', value)}
      required
    />
    <output data-testid="url-company-id">{companyId || ''}</output>
    <output data-testid="url-object-id">{objectId || ''}</output>
  </QueryClientProvider>;
};

const choose = async (label: string, option: string) => {
  const input = await screen.findByLabelText(label);
  fireEvent.mouseDown(input);
  fireEvent.click(await screen.findByText(option));
};

describe('PEK scope company and object selector', () => {
  it('keeps companyId when company and object filters are synchronized through URL params', async () => {
    render(<UrlHarness />);
    await choose('Компания *', 'ТОО «Eco Company» · БИН 123456789012');
    expect(screen.getByTestId('url-company-id').textContent).toBe('10');
    await waitFor(() => expect(objectRequests).toContain(10));
    await choose('Объект *', 'Площадка Север · Шымкент');
    expect(screen.getByTestId('url-object-id').textContent).toBe('101');
  });

  it('shows named companies, stores companyId and loads only its objects', async () => {
    render(<Harness />);
    await choose('Компания *', 'ТОО «Eco Company» · БИН 123456789012');
    expect(screen.getByTestId('company-id').textContent).toBe('10');
    await waitFor(() => expect(objectRequests).toContain(10));
    await choose('Объект *', 'Площадка Север · Шымкент');
    expect(screen.getByTestId('object-id').textContent).toBe('101');
  });

  it('resets objectId on company change and never exposes another company object', async () => {
    render(<Harness />);
    await choose('Компания *', 'ТОО «Eco Company» · БИН 123456789012');
    await choose('Объект *', 'Площадка Север · Шымкент');
    await choose('Компания *', 'ТОО «Second Company» · БИН 210987654321');
    expect(screen.getByTestId('company-id').textContent).toBe('20');
    expect(screen.getByTestId('object-id').textContent).toBe('');
    await waitFor(() => expect(objectRequests).toContain(20));
    expect(screen.queryByText('Площадка Север · Шымкент')).toBeNull();
  });

  it('auto-selects the only company and the only active object', async () => {
    scopeCompanies = [companies[0]];
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('company-id').textContent).toBe('10'));
    await waitFor(() => expect(screen.getByTestId('object-id').textContent).toBe('101'));
  });

  it('shows API errors and offers retry', async () => {
    companyStatus = 403;
    render(<Harness />);
    expect(await screen.findByText('Не удалось загрузить компании')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Повторить' })).not.toBeNull();
  });

  it('does not allow a companyId to be entered manually', async () => {
    const view = render(<Harness />);
    const input = await screen.findByLabelText('Компания *');
    fireEvent.change(input, { target: { value: '999' } });
    expect(screen.getByTestId('company-id').textContent).toBe('');
    expect(view.container.querySelector('input[type="number"]')).toBeNull();
    expect(view.container.querySelector('datalist')).toBeNull();
  });
});
