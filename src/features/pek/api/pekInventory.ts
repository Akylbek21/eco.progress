import { pekApiClient as api } from './pekApiClient';
import { unwrapPekData } from './pekMappers';
import { pekMutationOptions } from './pekMutation';

export type InventoryKind = 'emission-sources' | 'discharge-sources' | 'waste-items' | 'waste-movements';
export type InventoryValue = string | number | boolean | null;
export type InventoryPayload = Record<string, InventoryValue>;
export type InventoryRow = InventoryPayload & { id: number; version: number };
const path = (parentId: number, kind: InventoryKind) =>
  `/pek/${kind === 'waste-movements' ? 'reports' : 'programs'}/${parentId}/${kind}`;

export const pekInventoryApi = {
  list: async (parentId: number, kind: InventoryKind, signal?: AbortSignal) =>
    unwrapPekData<InventoryRow[]>((await api.get(path(parentId, kind), { signal })).data),
  save: async (parentId: number, kind: InventoryKind, body: InventoryPayload, existing?: InventoryRow) => {
    const options = existing ? pekMutationOptions(existing.version) : undefined;
    const url = path(parentId, kind);
    const response = existing && kind !== 'waste-movements'
      ? await api.put(`${url}/${existing.id}`, body, options)
      : await api.post(url, body, options);
    return unwrapPekData<InventoryRow>(response.data);
  },
  remove: async (parentId: number, kind: InventoryKind, row: InventoryRow) => {
    await api.delete(`${path(parentId, kind)}/${row.id}`, pekMutationOptions(row.version));
  },
};
