import { useQuery } from '@tanstack/react-query';
import { getLaboratory } from '../api/laboratoryService';
import { laboratoryQueryKeys } from './queryKeys';
export const useLaboratory = (id: number, enabled = true) => useQuery({ queryKey: laboratoryQueryKeys.detail(id), queryFn: ({ signal }) => getLaboratory(id, signal), enabled: enabled && id > 0 });
