import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { LaboratoriesQuery } from '../../../types/laboratories';
import { getLaboratories } from '../api/laboratoryService';
import { laboratoryQueryKeys } from './queryKeys';
export const useLaboratories = (query: LaboratoriesQuery) => useQuery({ queryKey: laboratoryQueryKeys.list(query), queryFn: ({ signal }) => getLaboratories(query, signal), placeholderData: keepPreviousData });
