// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PekInventoryEditor from '../src/features/pek/components/inventory/PekInventoryEditor';
import PekReportPackageCard from '../src/features/pek/components/documents/PekReportPackageCard';
import { pekInventoryApi } from '../src/features/pek/api/pekInventory';
import { pekApi } from '../src/features/pek/api/pekService';
import { pekApiClient } from '../src/features/pek/api/pekApiClient';
import { inventoryPayload } from '../src/features/pek/model/pekInventoryFields';
import { canGeneratePekPackage } from '../src/features/pek/utils/pekPackageActions';
import type { PekReport } from '../src/features/pek/api/pekContracts';

vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: 'ADMIN' } }) }));
const report = (actions: Record<string, boolean>, status = 'DRAFT') => ({ id: 9, companyId: 2, programId: 1, version: 0, status, availableActions: actions }) as PekReport;
const clients: QueryClient[] = [];
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); });

describe('PEK package regressions', () => {
  it('supports old-server document permission but preserves explicit denials and locked statuses', () => {
    expect(canGeneratePekPackage(report({ generateDocument: true }))).toBe(true);
    expect(canGeneratePekPackage(report({ generateDocument: true, generatePackage: false }))).toBe(false);
    expect(canGeneratePekPackage(report({ generateDocument: true }), false)).toBe(false);
    expect(canGeneratePekPackage(report({}))).toBe(false);
    for (const status of ['SIGNED', 'ARCHIVED']) expect(canGeneratePekPackage(report({ generatePackage: true }, status), true)).toBe(false);
  });
  it('renders first generation for the action returned by the archived backend', async () => {
    vi.spyOn(pekApi, 'getReportPackage').mockResolvedValue(null);
    mount(<PekReportPackageCard report={report({ generateDocument: true })} />);
    expect((await screen.findByRole('button', { name: 'Сформировать комплект ПЭК' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('allows regeneration when the previous package still carries missing fields', async () => {
    vi.spyOn(pekApi, 'getReportPackage').mockResolvedValue({ id: 2, reportId: 9, documentVersion: 1, sourceContentRevision: 1, files: [], missingFields: ['protocols[1].pdf'], generatedAt: '', generatedBy: 7, downloadAvailable: true, availableActions: { generatePackage: true, downloadPackage: true }, version: 0 });
    mount(<PekReportPackageCard report={report({ generateDocument: true })} />);
    expect((await screen.findByRole('button', { name: 'Сформировать комплект ПЭК' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('PEK inventory integration', () => {
  it('preserves decimal precision, clears empty values and validates limits/BIN', () => {
    const payload = inventoryPayload('emission-sources', { name: 'Источник', code: '1', heightM: '12345678901234567890,123456789', operatingHoursPerYear: '0' });
    expect(payload.heightM).toBe('12345678901234567890.123456789');
    expect(payload.operatingHoursPerYear).toBe(0);
    expect(payload.description).toBe(null);
    expect(() => inventoryPayload('emission-sources', { name: 'X', code: '1', cleaningEfficiencyPercent: '101' })).toThrow('максимум');
    expect(() => inventoryPayload('waste-movements', { wasteItemId: '3', receiverBin: '123' })).toThrow('12 цифр');
    expect(() => inventoryPayload('waste-movements', { wasteItemId: '3', generated: '-1' })).toThrow('неотрицательное');
  });
  it('uses row versions including zero for update/delete and POST for movement upsert', async () => {
    const put = vi.spyOn(pekApiClient, 'put').mockResolvedValue({ data: { data: { id: 3, version: 1 } } });
    const post = vi.spyOn(pekApiClient, 'post').mockResolvedValue({ data: { data: { id: 3, version: 1 } } });
    const del = vi.spyOn(pekApiClient, 'delete').mockResolvedValue({ data: {} });
    const row = { id: 3, version: 0 };
    await pekInventoryApi.save(1, 'emission-sources', { name: 'X' }, row);
    expect(put).toHaveBeenCalledWith('/pek/programs/1/emission-sources/3', { name: 'X' }, expect.objectContaining({ headers: { 'If-Match': '0' } }));
    await pekInventoryApi.save(9, 'waste-movements', { wasteItemId: 3 }, row);
    expect(post).toHaveBeenCalledWith('/pek/reports/9/waste-movements', { wasteItemId: 3 }, expect.objectContaining({ headers: { 'If-Match': '0' } }));
    await pekInventoryApi.remove(1, 'emission-sources', row);
    expect(del).toHaveBeenCalledWith('/pek/programs/1/emission-sources/3', expect.objectContaining({ headers: { 'If-Match': '0' } }));
  });
  it('saves a new source using named fields and refreshes the list', async () => {
    vi.spyOn(pekInventoryApi, 'list').mockResolvedValue([]);
    const save = vi.spyOn(pekInventoryApi, 'save').mockResolvedValue({ id: 3, version: 0 });
    mount(<PekInventoryEditor kind="emission-sources" parentId={1} programId={1} companyId={2} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить запись' }));
    fireEvent.change(screen.getByLabelText(/код источника/), { target: { value: '001' } });
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: 'Котельная' } });
    fireEvent.change(screen.getByLabelText('Высота, м'), { target: { value: '12,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(1, 'emission-sources', expect.objectContaining({ code: '001', name: 'Котельная', heightM: '12.5' }), undefined));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
  });
  it('keeps read-only inventory free of mutation buttons', async () => {
    vi.spyOn(pekInventoryApi, 'list').mockResolvedValue([{ id: 3, version: 0, name: 'Источник' }]);
    mount(<PekInventoryEditor kind="emission-sources" parentId={1} programId={1} canEdit={false} />);
    await screen.findByRole('heading', { name: 'Источник' });
    expect(screen.queryByRole('button', { name: 'Добавить запись' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Изменить' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Удалить' })).toBe(null);
  });
  it('blocks resubmitting stale edits after a version conflict', async () => {
    vi.spyOn(pekInventoryApi, 'list').mockResolvedValue([{ id: 3, version: 0, name: 'Источник', code: '001' }]);
    vi.spyOn(pekInventoryApi, 'save').mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_VERSION_CONFLICT' } } });
    mount(<PekInventoryEditor kind="emission-sources" parentId={1} programId={1} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText(/Закройте форму/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('edits a waste movement with its own version and displays a balance discrepancy', async () => {
    const row = { id: 4, version: 2, wasteItemId: 3, wasteItemName: 'Зола', unit: 'т', openingBalance: '10', generated: '1', closingBalance: '9', impliedClosingBalance: '11', reconciles: false };
    vi.spyOn(pekInventoryApi, 'list').mockImplementation(async (_id, kind) => kind === 'waste-items' ? [{ id: 3, version: 0, name: 'Зола', limitUnit: 'т' }] : [row]);
    const save = vi.spyOn(pekInventoryApi, 'save').mockResolvedValue(row);
    mount(<PekInventoryEditor kind="waste-movements" parentId={9} programId={1} canEdit />);
    await screen.findByText(/Баланс не сходится/);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    fireEvent.change(screen.getByLabelText('Остаток на конец'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(9, 'waste-movements', expect.objectContaining({ wasteItemId: 3, closingBalance: '11' }), row));
  });
  it('requires confirmation before deleting a row', async () => {
    const row = { id: 3, version: 0, name: 'Источник', code: '001' };
    vi.spyOn(pekInventoryApi, 'list').mockResolvedValue([row]);
    const remove = vi.spyOn(pekInventoryApi, 'remove').mockResolvedValue();
    mount(<PekInventoryEditor kind="emission-sources" parentId={1} programId={1} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1, 'emission-sources', row));
  });
});
