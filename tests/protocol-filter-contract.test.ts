import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/ProtocolsPage.tsx'), 'utf8');

describe('protocol list backend filter contract', () => {
  it('persists every supported filter in URL-backed query state', () => {
    for (const filter of [
      'search', 'status', 'templateId', 'subtype', 'companyId', 'objectId',
      'laboratoryId', 'executorId', 'compliance', 'published', 'dateFrom',
      'dateTo', 'includeArchived', 'sort',
    ]) expect(page).toContain(`params.get('${filter}')`);
    expect(page).toContain('activeFilters.map');
    expect(page).toContain('Сбросить всё');
  });

  it('resets pagination and dependent selectors', () => {
    expect(page).toContain('companyId: event.target.value, objectId: undefined, page: 0');
    expect(page).toContain('laboratoryId: event.target.value, executorId: undefined, page: 0');
    expect(page).toContain('getCompanyObjects(companyId, false, signal)');
    expect(page).toContain('getLaboratoryEmployees(laboratoryId, { signal })');
  });

  it('blocks an invalid date range and has distinct filtered empty copy', () => {
    expect(page).toContain('query.dateFrom <= query.dateTo');
    expect(page).toContain('enabled: Boolean(user?.id) && dateRangeValid');
    expect(page).toContain('По выбранным фильтрам протоколы не найдены');
  });
});
