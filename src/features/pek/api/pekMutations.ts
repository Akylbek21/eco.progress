import type { MutationOptions } from '@tanstack/react-query';
import type {
  PekCollectionRun,
  PekMutationBody,
  PekProgram,
  PekProgramRequest,
  PekReport,
} from './pekContracts';
import { pekApi } from './pekApi';

export const pekMutations = {
  createProgram: (): MutationOptions<PekProgram, unknown, PekProgramRequest> => ({
    mutationKey: ['pek', 'programs', 'create'],
    mutationFn: (body) => pekApi.createProgram(body),
    retry: false,
  }),
  updateProgram: (id: number): MutationOptions<PekProgram, unknown, PekProgramRequest & { version: number }> => ({
    mutationKey: ['pek', 'programs', String(id), 'update'],
    mutationFn: (body) => pekApi.updateProgram(id, body),
    retry: false,
  }),
  createReport: (): MutationOptions<PekReport, unknown, PekMutationBody> => ({
    mutationKey: ['pek', 'reports', 'create'],
    mutationFn: (body) => pekApi.createReport(body),
    retry: false,
  }),
  collectReport: (id: number): MutationOptions<PekCollectionRun, unknown, PekMutationBody> => ({
    mutationKey: ['pek', 'reports', String(id), 'collect'],
    mutationFn: (body) => pekApi.collectReport(id, body),
    retry: false,
  }),
};
