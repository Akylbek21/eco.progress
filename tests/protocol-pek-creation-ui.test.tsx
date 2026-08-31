// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PekProtocolCreationFlow from '../src/features/protocols/components/PekProtocolCreationFlow';

const getActiveCompanies = vi.fn();
const getCompanyObjects = vi.fn();
const getProtocolCreationContext = vi.fn();
const createProtocolFromPek = vi.fn();

vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'staff-1', role: 'ADMIN', type: 'staff', permissions: ['view_pek'] } }),
}));

vi.mock('../src/services/companyService', () => ({
  getActiveCompanies: (...args: unknown[]) => getActiveCompanies(...args),
  getCompanyObjects: (...args: unknown[]) => getCompanyObjects(...args),
}));

vi.mock('../src/services/protocolService', () => ({
  default: {
    getProtocolCreationContext: (...args: unknown[]) => getProtocolCreationContext(...args),
    createProtocolFromPek: (...args: unknown[]) => createProtocolFromPek(...args),
  },
}));

const context = {
  hasActiveProgram: true,
  company: { id: '1', name: 'ТОО AstanaCeramic' },
  object: { id: '10', name: 'Кирпичный завод' },
  program: { id: '250', number: '250' },
  period: { year: 2026, quarter: 3 },
  requirements: [
    {
      id: 'completed-south', status: 'COMPLETED', title: 'Атмосферный воздух — СЗЗ',
      planCount: 1, completedCount: 1, missingCount: 0, canCreate: false,
      companyId: '1', objectId: '10', pekProgramId: '250', pekMonitoringId: '501',
      pekControlItemId: '601', monitoringPointId: 'south', monitoringPointName: 'СЗЗ — Юг',
      protocolTemplateId: 'ambient_air', indicators: [],
    },
    {
      id: 'due-north', status: 'DUE', title: 'Атмосферный воздух — СЗЗ', frequency: 'Ежеквартально',
      planCount: 1, completedCount: 0, missingCount: 1, canCreate: true,
      companyId: '1', objectId: '10', pekProgramId: '250', pekMonitoringId: '500',
      pekControlItemId: '600', monitoringPointId: 'north', monitoringPointName: 'СЗЗ — Север',
      protocolTemplateId: 'ambient_air', protocolTemplateName: 'Атмосферный воздух', laboratoryName: 'EcoLab',
      indicators: [{ id: 'no2', name: 'Диоксид азота', unit: 'мг/м³', normativeLabel: '≤ 0.2' }],
    },
  ],
};

const renderFlow = (onCreated = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    onCreated,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PekProtocolCreationFlow open onClose={vi.fn()} onManual={vi.fn()} onCreated={onCreated} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
};

const selectCompany = async () => {
  const input = await screen.findByLabelText('Компания *');
  await screen.findByRole('option', { name: 'ТОО AstanaCeramic' });
  fireEvent.change(input, { target: { value: '1' } });
  await waitFor(() => expect(getCompanyObjects).toHaveBeenCalledWith('1', false, expect.anything()));
};

beforeEach(() => {
  getActiveCompanies.mockResolvedValue([{ id: '1', name: 'ТОО AstanaCeramic', bin: '123', status: 'ACTIVE' }]);
  getCompanyObjects.mockResolvedValue([{ id: '10', version: 1, name: 'Кирпичный завод', address: 'Шымкент', coordinates: '', activityType: '', sanitaryZone: '', notes: '', samplingLocation: '', status: 'ACTIVE' }]);
  getProtocolCreationContext.mockResolvedValue(context);
  createProtocolFromPek.mockResolvedValue({ id: 'protocol-77', status: 'DRAFT', version: 1 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PEK-first protocol creation flow', () => {
  it('starts with company, auto-selects the only object, and renders point-specific requirements in priority order', async () => {
    const view = renderFlow();
    expect(screen.getByLabelText('Компания *')).toBeTruthy();
    expect(screen.queryByLabelText(/Тип протокола/)).toBeNull();

    await selectCompany();
    expect(await screen.findByText('Объект выбран автоматически')).toBeTruthy();
    expect(await screen.findByText('Что необходимо выполнить по ПЭК')).toBeTruthy();
    expect(getProtocolCreationContext).toHaveBeenCalledWith(expect.objectContaining({ companyId: '1', objectId: '10' }), expect.anything());

    const cards = Array.from(view.container.querySelectorAll('article'));
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('СЗЗ — Север');
    expect(cards[1].textContent).toContain('СЗЗ — Юг');
    expect(cards[0].textContent).toContain('≤ 0.2 мг/м³');
    expect(screen.getAllByRole('button', { name: 'Создать протокол' })).toHaveLength(1);
  });

  it('creates a draft only from backend requirement identifiers and opens the returned protocol', async () => {
    const { onCreated } = renderFlow();
    await selectCompany();
    fireEvent.click(await screen.findByRole('button', { name: 'Создать протокол' }));

    await waitFor(() => expect(createProtocolFromPek).toHaveBeenCalledWith({
      companyId: '1',
      objectId: '10',
      pekProgramId: '250',
      pekMonitoringId: '500',
      pekControlItemId: '600',
      monitoringPointId: 'north',
      protocolTemplateId: 'ambient_air',
    }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'protocol-77', status: 'DRAFT' })));
  });
});
