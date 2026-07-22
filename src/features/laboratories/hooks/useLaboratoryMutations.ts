import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LaboratoryFormValues } from '../../../types/laboratories';
import { createLaboratory, updateLaboratory } from '../api/laboratoryService';
import { laboratoryQueryKeys } from './queryKeys';
export const useLaboratoryMutations = () => {
  const client = useQueryClient();
  const createMutation = useMutation({ mutationFn: createLaboratory, onSuccess: (laboratory) => { client.setQueryData(laboratoryQueryKeys.detail(laboratory.id), laboratory); void client.invalidateQueries({ queryKey: laboratoryQueryKeys.lists() }); if (laboratory.isDefault) void client.invalidateQueries({ queryKey: laboratoryQueryKeys.default() }); } });
  const updateMutation = useMutation({ mutationFn: ({ id, values }: { id: number; values: LaboratoryFormValues }) => updateLaboratory(id, values), onSuccess: (laboratory) => { client.setQueryData(laboratoryQueryKeys.detail(laboratory.id), laboratory); void client.invalidateQueries({ queryKey: laboratoryQueryKeys.lists() }); void client.invalidateQueries({ queryKey: laboratoryQueryKeys.default() }); } });
  return { createMutation, updateMutation };
};
