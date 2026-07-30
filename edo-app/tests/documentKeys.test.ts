import { describe, expect, it } from 'vitest';
import { documentKeys } from '../src/features/documents/api/documentKeys';

describe('tenant-scoped document query keys', () => {
  it('isolates dashboard and details caches by organization', () => {
    expect(documentKeys.dashboard('org-a')).not.toEqual(documentKeys.dashboard('org-b'));
    expect(documentKeys.details('org-a', 'doc-1')).not.toEqual(documentKeys.details('org-b', 'doc-1'));
  });

  it('normalizes list filters for stable caching', () => {
    const left = documentKeys.list('org-a', { page: 0, size: 25, sort: 'createdAt,desc', status: 'DRAFT' });
    const right = documentKeys.list('org-a', { status: 'DRAFT', sort: 'createdAt,desc', size: 25, page: 0 });
    expect(left).toEqual(right);
  });
});
