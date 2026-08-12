import type { QueryClient } from '@tanstack/react-query';
import type { PekProgram } from './pekContracts';
import { pekKeys } from './pekQueryKeys';

export const commitPekProgramMutation = async (
  queryClient: QueryClient,
  companyId: string | number | null | undefined,
  program: PekProgram,
) => {
  queryClient.setQueryData(pekKeys.programDetail(companyId, program.id), program);
  await queryClient.invalidateQueries({ queryKey: pekKeys.programsRoot() });
};
