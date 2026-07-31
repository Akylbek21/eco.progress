import type { PekProgramForm } from '../api/pekContracts';

export const pekProgramDefaults: PekProgramForm = {
  companyId: 0,
  objectId: 0,
  number: '',
  name: '',
  description: '',
  validFrom: '',
  validUntil: '',
  responsibleUserId: null,
  controlItems: [],
  indicators: [],
  measures: [],
};
