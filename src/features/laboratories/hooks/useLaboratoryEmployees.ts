import { useQuery } from '@tanstack/react-query';
import { getLaboratoryEmployees } from '../api/laboratoryService';
import { laboratoryQueryKeys } from './queryKeys';
export const useLaboratoryEmployees = (laboratoryId: number, includeInactive = false) => useQuery({ queryKey: [...laboratoryQueryKeys.employees(laboratoryId), { includeInactive }], queryFn: ({ signal }) => getLaboratoryEmployees(laboratoryId, { includeInactive, signal }), enabled: laboratoryId > 0 });
