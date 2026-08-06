import type { ProtocolListQuery } from '../../../types/protocols';

export const protocolScope = (userId: string | number | null | undefined) =>
  `backend-resolved:${userId ?? 'unauthenticated'}`;

export const protocolQueryKeys = {
  all: (scope: string) => ['protocols', scope] as const,
  lists: (scope: string) => [...protocolQueryKeys.all(scope), 'list'] as const,
  list: (scope: string, query: ProtocolListQuery) => [...protocolQueryKeys.lists(scope), query] as const,
  details: (scope: string) => [...protocolQueryKeys.all(scope), 'detail'] as const,
  detail: (scope: string, id: string | number) => [...protocolQueryKeys.details(scope), String(id)] as const,
  results: (scope: string, id: string | number) => [...protocolQueryKeys.detail(scope, id), 'results'] as const,
  history: (scope: string, id: string | number) => [...protocolQueryKeys.detail(scope, id), 'history'] as const,
  documents: (scope: string, id: string | number) => [...protocolQueryKeys.detail(scope, id), 'documents'] as const,
  signatures: (scope: string, id: string | number) => [...protocolQueryKeys.detail(scope, id), 'signatures'] as const,
};
