import type { ProtocolListQuery } from '../../../types/protocols';

export const protocolQueryKeys = {
  all: ['protocols'] as const,
  lists: () => [...protocolQueryKeys.all, 'list'] as const,
  list: (query: ProtocolListQuery) => [...protocolQueryKeys.lists(), query] as const,
  details: () => [...protocolQueryKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...protocolQueryKeys.details(), String(id)] as const,
  history: (id: string | number) => [...protocolQueryKeys.detail(id), 'history'] as const,
  documents: (id: string | number) => [...protocolQueryKeys.detail(id), 'documents'] as const,
};
