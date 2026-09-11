import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pekApiClient } from '../src/features/pek/api/pekApiClient';
import { pekKeys } from '../src/features/pek/api/pekQueryKeys';
import { pekApi } from '../src/features/pek/api/pekService';
import { mapAssigneesResponse, mergeAssigneesWithCompanyStaff } from '../src/features/pek/mappers/responseMappers';

afterEach(() => vi.restoreAllMocks());

describe('PEK settings assignees', () => {
  it('requests responsible assignees for the current company and maps the backend DTO', async () => {
    const get = vi.spyOn(pekApiClient, 'get').mockResolvedValue({
      data: {
        data: [{ id: 71, name: 'Алёна Сергеевна', description: 'Эколог', status: 'ACTIVE', role: 'PEK_RESPONSIBLE' }],
      },
    });

    await expect(pekApi.getAssignees(17, ['PEK_RESPONSIBLE'])).resolves.toEqual([
      { id: 71, name: 'Алёна Сергеевна', description: 'Эколог', status: 'ACTIVE', role: 'PEK_RESPONSIBLE' },
    ]);
    expect(get).toHaveBeenCalledWith('/pek/lookups/assignees', {
      params: { companyId: 17, roles: 'PEK_RESPONSIBLE' },
      signal: undefined,
    });
  });

  it('keeps every valid backend row and supports deployed user field aliases', () => {
    expect(mapAssigneesResponse([
      { id: 1, name: 'Первый', status: 'ACTIVE' },
      { userId: '2', fullName: 'Второй', status: 'active' },
      { id: 3, userFullName: 'Третий', status: 'INACTIVE' },
    ])).toEqual([
      { id: 1, name: 'Первый', status: 'ACTIVE' },
      { id: 2, name: 'Второй', status: 'active' },
      { id: 3, name: 'Третий', status: 'INACTIVE' },
    ]);
  });

  it('uses a company-scoped prefix so all role variants are invalidated after staff changes', () => {
    const root = pekKeys.assigneesRoot(17, 9);
    expect(pekKeys.assignees(17, ['PEK_RESPONSIBLE'], 9).slice(0, root.length)).toEqual(root);

    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/components/settings/PekCompanyStaff.tsx'), 'utf8');
    expect(source).toContain('pekKeys.assigneesRoot(companyId, user?.id)');
    expect(source).toContain("refetchType: 'active'");
    expect(source.match(/onSuccess: async \(\) => \{ await refresh\(\);/g)).toHaveLength(3);
  });

  it('adds active company staff omitted by the role lookup without duplicating lookup users', () => {
    expect(mergeAssigneesWithCompanyStaff(
      [{ id: 7, name: 'Эколог' }],
      [
        { id: 101, companyId: 5, userId: 7, userFullName: 'Эколог', userEmail: 'eco@example.kz', tier: 'EDITOR', status: 'ACTIVE', createdAt: '', updatedAt: '', version: 0 },
        { id: 102, companyId: 5, userId: 9, userFullName: 'Администратор', userEmail: 'admin@example.kz', tier: 'REVIEWER', status: 'ACTIVE', createdAt: '', updatedAt: '', version: 0 },
        { id: 103, companyId: 5, userId: 10, userFullName: 'Отключён', userEmail: 'off@example.kz', tier: 'VIEWER', status: 'INACTIVE', createdAt: '', updatedAt: '', version: 0 },
      ],
    )).toEqual([
      { id: 7, name: 'Эколог' },
      { id: 9, name: 'Администратор', description: 'admin@example.kz', status: 'ACTIVE', role: 'PEK_RESPONSIBLE' },
    ]);
  });

  it('uses the merged company staff options in the program form', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(source).toContain('mergeAssigneesWithCompanyStaff(assignees.data, companyStaff.data)');
    expect(source).not.toContain('options={assignees.data || []}');
  });
});
