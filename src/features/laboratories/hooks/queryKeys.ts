import type { LaboratoriesQuery } from '../../../types/laboratories';
export const laboratoryQueryKeys = {
  all: ['laboratories'] as const,
  lists: () => [...laboratoryQueryKeys.all, 'list'] as const,
  list: (query: LaboratoriesQuery) => [...laboratoryQueryKeys.lists(), query] as const,
  details: () => [...laboratoryQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...laboratoryQueryKeys.details(), id] as const,
  default: () => [...laboratoryQueryKeys.all, 'default'] as const,
  employees: (laboratoryId: number) => [...laboratoryQueryKeys.detail(laboratoryId), 'employees'] as const,
};
