// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PekMonitoringPoints from '../src/features/pek/components/monitoring/PekMonitoringPoints';
import PekControlSourceSelect from '../src/features/pek/components/inventory/PekControlSourceSelect';
import PekReadinessPanel from '../src/features/pek/components/common/PekReadinessPanel';
import { pekApi } from '../src/features/pek/api/pekService';
import { pekInventoryApi } from '../src/features/pek/api/pekInventory';
import { serializeCoordinates } from '../src/features/pek/utils/pekCoordinates';
import { canUsePekPermission, canViewPek } from '../src/features/pek/permissions/pekAccess';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inventoryPayload } from '../src/features/pek/model/pekInventoryFields';
import type { PekProgram } from '../src/features/pek/api/pekContracts';

vi.mock('../src/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, permissions: ['PEK_VIEW'] } }) }));
const clients: QueryClient[] = [];
const mount = (element: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
};
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); });

it('serializes bounds and zero without losing coordinates; rejects invalid or partial pairs', () => {
  expect(serializeCoordinates('0', '0')).toBe('0, 0');
  expect(serializeCoordinates('-90', '180')).toBe('-90, 180');
  expect(serializeCoordinates('52,5', '69.1')).toBe('52.5, 69.1');
  expect(serializeCoordinates('', '')).toBeNull();
  for (const pair of [['91', '0'], ['0', '-181'], ['NaN', '0'], ['1', '']]) {
    expect(() => serializeCoordinates(pair[0], pair[1])).toThrow();
  }
  expect(inventoryPayload('waste-items', { name: 'Отход', coordinates: '-90, 180' }).coordinates).toBe('-90, 180');
  expect(() => inventoryPayload('waste-items', { name: 'Отход', coordinates: '91, 0' })).toThrow();
});

it('uses coordinates in the mutation and restores them after reopening the saved point', async () => {
  let point = { id: 3, programId: 1, monitoringId: 2, name: 'Точка', coordinates: '0, 0', description: null, version: 0 };
  vi.spyOn(pekApi, 'getMonitoringPoints').mockImplementation(async () => [point]);
  const update = vi.spyOn(pekApi, 'updateMonitoringPoint').mockImplementation(async (_program, _id, _version, body) => {
    point = { ...point, coordinates: body.coordinates!, version: 1 };
    return point;
  });
  mount(<PekMonitoringPoints programId={1} monitoringId={2} editable />);
  fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
  fireEvent.change(screen.getByLabelText('Широта'), { target: { value: '-90' } });
  fireEvent.change(screen.getByLabelText('Долгота'), { target: { value: '180' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(1, 3, 0, { name: 'Точка', coordinates: '-90, 180', description: null }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
  expect((screen.getByLabelText('Широта') as HTMLInputElement).value).toBe('-90');
  expect((screen.getByLabelText('Долгота') as HTMLInputElement).value).toBe('180');
});

it('loads each source registry and monitoring points only for the selected program', async () => {
  vi.spyOn(pekApi, 'getProgram').mockResolvedValue({ monitoring: { items: [{ id: 8 }] } } as PekProgram);
  const points = vi.spyOn(pekApi, 'getMonitoringPoints').mockResolvedValue([]);
  const list = vi.spyOn(pekInventoryApi, 'list').mockResolvedValue([]);
  mount(<PekControlSourceSelect programId={5} value={{ code: '1', name: 'Позиция', mandatory: true, sortOrder: 0, active: true }} onChange={() => {}} />);
  await waitFor(() => expect(points).toHaveBeenCalledWith(5, 8, expect.any(AbortSignal)));
  expect(list.mock.calls.map(call => call.slice(0, 2))).toEqual([[5, 'emission-sources'], [5, 'discharge-sources'], [5, 'waste-items']]);
});

it('never grants PEK mutation permissions from a role alone', () => {
  for (const permission of ['PEK_PROGRAM_EDIT', 'PEK_PROGRAM_APPROVE', 'PEK_REPORT_SIGN', 'PEK_REPORT_SUBMIT']) {
    expect(canUsePekPermission({ role: 'ADMIN' }, permission)).toBe(false);
    expect(canUsePekPermission({ role: 'ADMIN', permissions: [] }, permission)).toBe(false);
    expect(canUsePekPermission({ permissions: [permission] }, permission)).toBe(true);
  }
  expect(canViewPek({ role: 'ECOLOGIST' })).toBe(true);
  expect(canViewPek({ role: 'ECOLOGIST', permissions: [] })).toBe(false);
});

it('serializes manual and delayed program autosaves before using a version', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
  expect(source).toContain('const autosavePendingRef = useRef(false)');
  expect(source).toContain('if (autosavePendingRef.current) queuedAutosave.current = value');
  expect(source).toContain('window.clearTimeout(autosaveTimer.current)');
  expect(source).toContain('onSettled: () =>');
});

it('counts backend ERROR issues using the authoritative blocking flag', () => {
  render(<PekReadinessPanel readiness={{ ready: false, completionPercent: 50, issues: [
    { code: 'NO_EMERGENCY_PROCEDURES', section: 'EMERGENCY_PROCEDURES', severity: 'ERROR', blocking: true, message: 'Добавьте действия при аварии' },
    { code: 'MISSING_ACTIVE_PERMIT', severity: 'WARNING', blocking: false, message: 'Проверьте разрешение' },
  ] }} onIssueClick={() => {}} />);
  expect(screen.getByText('Утверждение заблокировано. Проблем: 1')).toBeTruthy();
  expect(screen.getByText('Блокирует отправку')).toBeTruthy();
  expect(screen.getByText('Предупреждение')).toBeTruthy();
});
